/**
 * Copyright (C) 2013 momomo.com <opensource@momomo.com>
 *
 * Licensed under the GNU LESSER GENERAL PUBLIC LICENSE, Version 3, 29 June 2007;
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.gnu.org/licenses/lgpl-3.0.txt
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @Author Mohamed Seifeddine
 * @Author Philip Nilsson
 */
(function() {
        define ? define([], callback) : callback();

        function callback() {
                var MoJS = window.MoJS || (window.MoJS = {});
                MoJS.MoEV || ( MoJS.MoEV = new MoEV() );
                return MoEV;
        }

        function MoEV() {
                var that    = this;
                var optionsGlobal = that.options = {
                        isProduction    : false,

                        // False for speedup, although unlikely to be harmful at all,
                        // but unecesary since the usage of this is probably less than 10% of overall main usage
                        // which make it unnessary to include by default in the remaining 90% of calls to listen
                        autoParseFnKey  : false,

                        // If undefined, then map cache is used, otherwise array cache
                        // The first one is faster, however, it will add a property 'optionsGlobal.key' at the on property
                        storageStrategy : undefined,

                        key             : "MoJS.MoEV.Internal.Key"
                };

                // These are used as an alternative approach if a hashmap which is quicker
                // by default is not requested for use beause it adds a property
                var cacheArrayKeys = [];
                var cacheArrayVals = [];
                var cacheMap       = {};

                that.notify = function (o) {
                        // === Params =========================================
                        var _key = o.key;
                        var _on  = o['on']  || that;
                        // ====================================================
                        if ( !_key && _on ) {
                                key = optionsGlobal.key;  // Key is optional if on is provided
                        }

                        var event = getOrCreateEventKeyFuncs(_on, _key);

                        // Call notify with all arguments but this first one
                        event.notify( Array.prototype.slice.call(arguments, 1) );
                };

                /**
                 * Subscribe is the best word to describe it really why I must have it,
                 * but it can be hard to spell for some why listen is more appropiate but
                 * sends the wrong message as it is not listening. Somebody pokes/notifies it.
                 *
                 * _o.key is required
                 * _fn    is required
                 */
                that.listen = that.subscribe = that.register = function(_o, _fn) {
                        // === Params =========================================
                        var _key              = _o.key;
                        var _on               = _o.on  || that;
                        var _fnKey            = resolveFnName(_o.fnKey, _fn);                   // Recommended to pass fnKey for faster lookup, alternatively give the function a name, else the body must match to identify equals
                        var _once             = _o.once == true   || _o.registerOnce == true;   // Defaults to false, either one is acceptable
                        var _callIfNotified   = _o.callIfNotified != false;                     // Default is true
                        var _notifyMax        = _o.notifyMax      || undefined;                 // Optional
                        // ====================================================
                        if ( !_key && _on ) {
                                key = optionsGlobal.key;  // Key is optional if on is provided
                        }


                        var event             = getOrCreateEventKeyFuncs (_on, _key);

                        var alreadyRegistered = false;
                        if ( _once ) {
                                if ( !_fnKey ) {
                                        _fnKey = autoParseFnKey(_fn);
                                }

                                if ( !_fnKey ) {
                                        exceptionThrowFn();
                                }

                                var index = event.indexOf( _fnKey );
                                if ( ~index ) {
                                        alreadyRegistered = true;
                                }
                        }

                        if ( !alreadyRegistered ) {
                                var eventFn = $EventFn(_fn, _fnKey);
                                event.funcs.push(eventFn); // Push it immediatly

                                eventFn.notifyMax = _notifyMax;

                                // If already notified, notify unless explictly told otherwise
                                if ( event.isNotified == true && _callIfNotified == true )
                                        eventFn.notify(event.notifyArgs);
                        }
                };

                /**
                 * Basically reverse a listen, that is unregister a function for a key and object
                 *
                 * Might be useful for instance if a user enters a textbox and starts editing a textfield,
                 * you might want to register a close window event listener, to let the user know that he is editing
                 * and if they want to continue. When they blur out of the textfield, you might want to unregister the
                 * close window event notification, but only for your own func as yours is no longer active but
                 * others might still subscribe to it.
                 *
                 * fn is optional, but if not provided then a fnKey is required and vice versa
                 */
                that.unlisten = that.unsubscribe = that.unregister = function(_o, _fn) {
                        // === Params =========================================
                        var _key         = _o.key;
                        var _on          = _o.on || that;
                        var _fnKey       = resolveFnName(_o.fnKey, _fn);
                        var all          = _o.all != false; // Defaults to true
                        // ====================================================

                        if ( !_fnKey ) {
                                if ( !_fn ) {
                                        exceptionThrow( "No fnKey was provided and no function either. One or the other is required so choose one, preferably the first one!" );
                                }
                                else {
                                        exceptionThrowFn();
                                }
                        }

                        return getOrCreateEventKeyFuncs (_on, _key).removeFn (_fnKey, 0, all);
                };

                /**
                 * Clear all funcs for key if provided, otherwise clear all keys and funcs
                 */
                that.clear = function(_o) {
                        if ( !_o ) {
                                return clearAll();
                        }
                        // === Params =========================================
                        var _key = _o.key;
                        var _on  = _o.on || that;
                        // ====================================================

                        if ( !_key ) {
                                clear(_on);
                        } else {
                                getOrCreateEventObject(_on).remove(_key); // Only one key for this _on object
                        }
                };

                that.switchOn = function(a, b) {
                        if (optionsGlobal.storageStrategy) {
                                cacheArrayKeys[ getArrayKey(a) ] = b;
                        } else {
                                cacheMap[b] = cacheMap[a];
                                delete cacheMap[a];
                        }
                };

                function clear(_on) {
                        if (optionsGlobal.storageStrategy) {
                                clearCacheArray(_on);
                        } else {
                                clearCacheMap(_on);
                        }
                }

                function clearCacheMap(_on) {
                        var cacheKey = getCacheKey(_on);
                        delete cacheMap[cacheKey];       // Delete all keys for this _on object
                }

                function clearCacheArray(_on) {
                        var i = getArrayKey(_on);
                        if (~i) {
                                cacheArrayKeys.splice(i, 1);
                                cacheArrayVals.splice(i, 1);
                        }
                }

                function clearAll() {
                        if ( optionsGlobal.storageStrategy ) {
                                clearAll_arrayCache();
                        } else {
                                clearAll_mapCache();
                        }
                }

                function clearAll_mapCache() {
                        for (var property in cacheMap) {
                                if ( cacheMap.hasOwnProperty(property) ) {
                                        delete cacheMap[property];
                                }
                        }
                }

                function clearAll_arrayCache() {
                        // We have no other references to these
                        cacheArrayKeys = [];
                        cacheArrayVals = [];
                }

                function getOrCreateEventObject(_on) {
                        if ( optionsGlobal.storageStrategy ) {
                                return getOrCreateEventObject_arrayCache(_on);
                        } else {
                                return getOrCreateEventObject_mapCache(_on);
                        }
                }

                function getOrCreateEventObject_mapCache(_on) {
                        var cacheKey = getCacheKey(_on);
                        if ( !cacheMap[cacheKey] ) {
                                cacheMap[cacheKey] = $EventObject();
                        }

                        return cacheMap[cacheKey];
                }

                function getOrCreateEventObject_arrayCache(_on) {
                        // Use arrayKeys to find the index, if found pull out from arrayVal on the same index
                        var i = getArrayKey(_on);
                        if ( ~i ) {
                                return cacheArrayVals[i];
                        }
                        else {
                                var eventObject = $EventObject();
                                cacheArrayKeys.push (_on);
                                cacheArrayVals.push  (eventObject);
                                return eventObject;
                        }
                }

                function getCacheKey(_on) {
                        var cacheKey = _on[optionsGlobal.key];
                        if ( !cacheKey ) {
                                _on[optionsGlobal.key] = Math.random().toString();
                                cacheKey       = _on[optionsGlobal.key];  // Has to be read on a separate line

                                // cacheKey might still not be set here if _on is a string or primitive for instance
                                // so we try to use the object itself as a key in those instances ofcourse this is not recommended.
                                // on should be an Object
                                if ( !cacheKey ) {
                                        return _on;
                                }
                        }

                        return cacheKey;
                }

                function getArrayKey(_on) {
                        return cacheArrayKeys.indexOf (_on);  // Will actually return an index, but we use as a "key"
                }

                function getOrCreateEventKeyFuncs(_on, _key) {
                        var eventObject = getOrCreateEventObject(_on);
                        if ( !eventObject ) {
                                exceptionThrow("An unlikely error occured with the 'on' object supplied: " + _on + " together with the 'key' : " + _key );
                        }
                        return eventObject.getOrCreateEventKeyFuncs(_key);
                }

                function resolveFnName(_fnKey, _fn) {
                        return _fnKey || autoParseFnKey(_fn) || undefined;
                }

                function autoParseFnKey(_fn) {
                        if ( optionsGlobal.autoParseFnKey == true ) {
                                return getFnName(_fn);
                        }
                }

                function exceptionThrowFn() {
                        exceptionThrow(
                                "Could not determine what the 'fnKey' was, please provide it explitly to ensure proper behaviour"
                                + (optionsGlobal.autoParseFnKey != true ? " or set the flag options.autoParseFnKey = true since this is false now" : "" ) + "!"
                        );
                }

                /**
                 * MOXY
                 * function abc() { ... } will return "abc"
                 * function () { ... } will return "function () { ... }"
                 */
                function getFnName(_function) {
                        if ( _function ) {
                                var str = _function.toString();
                                var m   = str.match(/^\s*function\s+([^\s\(]+)/);
                                return m ? m[1] : str;
                        }
                }

                function exceptionHeader(library) {
                        var lineArray = xChars(30, '=').split("");
                        lineArray.splice(parseInt(lineArray.length - 1) / 2 + 1, 0, " " + library + " Exception! "); // Push in the word ERROR in the middle
                        return lineArray.join("");
                }

                function exceptionThrow(message) {
                        if ( !optionsGlobal.isProduction ) {
                                var line = exceptionHeader(that.library);
                                throw str(
                                        "\n",
                                        line,
                                        "\n", "Message:", "\n",
                                        message,
                                        "\n",
                                        line
                                );
                        }
                }

                function xChars(i, iChar) {
                        var chars = "";
                        for ( ;i--; )  chars += iChar;
                        return chars;
                }
        }


        /**
         *
         */
        function $EventObject() {
                return {
                        files : {},
                        getOrCreateEventKeyFuncs : function (_key) {
                                var event = this.files[_key];
                                if ( !event ) {
                                        event = this.files[_key] = $EventKeyFuncs();
                                }
                                return event;
                        },
                        remove : function (key) {
                                delete this.files[key];
                        }
                }
        }

        /**
         * Hold the values for a registered key, for instance "menuClicked" which will have many funcs attached to it
         * The key is not relevant to itself, as it is the cache that manages the pointer to here
         */
        function $EventKeyFuncs() {
                return {
                        isNotified : false,
                        funcs      : [],          // Array of EventFunc's
                        notifyArgs : undefined,   // Last notify args, stored for later invocations

                        notify : function (args) {
                                this.notifyArgs = args;

                                for ( var i = 0; i < this.funcs.length; i++ ) {
                                        if ( this.funcs[i] ) {
                                                this.funcs[i].notify(args);
                                        }
                                }

                                this.isNotified = true;
                        },

                        indexOf : function(_fnKey, i) {
                                i = i || 0;
                                for ( ; i < this.funcs.length; i++ ) {
                                        if ( this.funcs[i].fnKey && this.funcs[i].fnKey == _fnKey ) {
                                                return i;
                                        }
                                }
                                return undefined;
                        },

                        removeFn : function(_fnKey, _from, _all, _totalRemoved) {
                                _totalRemoved = _totalRemoved || 0;

                                var i = this.indexOf( _fnKey, 0 );
                                if ( i ) {
                                        this.funcs.splice(i, 1);  // Remove
                                        _totalRemoved++;              // Increase counter

                                        // If we wish to remove all
                                        if ( _all ) {
                                                this.removeFn(_fnKey, i+1, _all, _totalRemoved );
                                        }
                                }

                                return _totalRemoved;
                        }
                };
        }


        /**
         * Represents one registered func for an Event, for instance "menuClicked" might have several of these
         *
         * @_fnKey is optional and if specified will allow for the deregistregistration of a func attached to an event
         */
        function $EventFn(_fn, _fnKey) {
                return {
                        notifiedNumberOfTImes : 0,
                        fnKey                 : _fnKey,
                        notifyMax             : undefined,

                        notify : function (args) {
                                if ( this.notifyMax == undefined ) {
                                        this.call(args);
                                }
                                else if ( this.leftToNofity() > 0 ) {
                                        this.call(args);
                                } else {
                                        // TODO Remove ??
                                }
                        },

                        leftToNofity : function () {
                                return this.notifyMax - this.notifiedNumberOfTImes;
                        },

                        call : function(args) {
                                _fn.apply(undefined, args);
                                this.notifiedNumberOfTImes++;
                        }
                };
        }
})();