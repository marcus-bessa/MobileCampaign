(function($, _, Backbone, forcetk) {

    "use strict";

    // Save a reference to the global object (`window` in the browser).
    var root = this;

    // Save the previous value of the `Force` variable, so that it can be
    // restored later on, if `noConflict` is used.
    var previousForce = root.Force;

    // The top-level namespace.
    var Force = this.Force = {};

    // Runs in *noConflict* mode, returning the `Force` variable
    // to its previous owner. Returns a reference to this Force object.
    Force.noConflict = function() {
        root.Force = previousForce;
        return this;
    };

    // Utility Function to turn methods with callbacks into jQuery promises
    var promiser = function(object, methodName, objectName) {
        var retfn = function () {
            var args = $.makeArray(arguments);
            var d = $.Deferred();
            args.push(function() {
                console.log("------> Calling successCB for " + objectName + ":" + methodName);
                try {
                    d.resolve.apply(d, arguments);
                }
                catch (err) {
                    console.error("------> Error when calling successCB for " + objectName + ":" + methodName);
                    console.error(err.stack);
                }
            });
            args.push(function() {
                console.log("------> Calling errorCB for " + objectName + ":" + methodName);
                try {
                    d.reject.apply(d, arguments);
                }
                catch (err) {
                    console.error("------> Error when calling errorCB for " + objectName + ":" + methodName);
                    console.error(err.stack);
                }
            });
            console.log("-----> Calling " + objectName + ":" + methodName);
            object[methodName].apply(object, args);
            return d.promise();
        };
        return retfn;
    };

    // Private forcetk client with promise-wrapped methods
    var forcetkClient = null;

    // Private smartstore client with promise-wrapped methods
    var smartstoreClient = null;

    // Helper function to patch user agent
    var patchUserAgent = function(userAgent) {
        var match = /^(SalesforceMobileSDK\/[^\ ]* [^\/]*\/[^\ ]* \([^\)]*\) [^\/]*\/[^ ]* )(Hybrid|Web)(.*$)/.exec(userAgent);
        if (match != null && match.length == 4) {
            return match[1] + match[2] + "SmartSync" + match[3];
        }
        else {
            // Not a SalesforceMobileSDK user agent, we leave it unchanged
            return userAgent;
        }
    };

    // Init function
    // * creds: credentials returned by authenticate call
    // * apiVersion: apiVersion to use, when null, v28.0 (Summer '13) is used
    // * innerForcetkClient: [Optional] A fully initialized forcetkClient to be re-used internally in the SmartSync library
    // * reauth: auth module for the refresh flow
    Force.init = function(creds, apiVersion, innerForcetkClient, reauth) {
        if (!apiVersion || apiVersion == null) {
            apiVersion = "v28.0";
        }

        if(!innerForcetkClient || innerForcetkClient == null) {
            innerForcetkClient = new forcetk.Client(creds.clientId, creds.loginUrl, creds.proxyUrl, reauth);
            innerForcetkClient.setSessionToken(creds.accessToken, apiVersion, creds.instanceUrl);
            innerForcetkClient.setRefreshToken(creds.refreshToken);
            innerForcetkClient.setUserAgentString(patchUserAgent(creds.userAgent || innerForcetkClient.getUserAgentString()));
        }

        forcetkClient = new Object();
        forcetkClient.impl = innerForcetkClient;
        forcetkClient.create = promiser(innerForcetkClient, "create", "forcetkClient");
        forcetkClient.retrieve = promiser(innerForcetkClient, "retrieve", "forcetkClient");
        forcetkClient.update = promiser(innerForcetkClient, "update", "forcetkClient");
        forcetkClient.del = promiser(innerForcetkClient, "del", "forcetkClient");
        forcetkClient.query = promiser(innerForcetkClient, "query", "forcetkClient");
        forcetkClient.queryMore = promiser(innerForcetkClient, "queryMore", "forcetkClient");
        forcetkClient.search = promiser(innerForcetkClient, "search", "forcetkClient");
        forcetkClient.metadata = promiser(innerForcetkClient, "metadata", "forcetkClient");
        forcetkClient.describe = promiser(innerForcetkClient, "describe", "forcetkClient");
        forcetkClient.describeLayout = promiser(innerForcetkClient, "describeLayout", "forcetkClient");
        forcetkClient.ownedFilesList = promiser(innerForcetkClient, "ownedFilesList", "forcetkClient");
        forcetkClient.filesInUsersGroups = promiser(innerForcetkClient, "filesInUsersGroups", "forcetkClient");
        forcetkClient.filesSharedWithUser = promiser(innerForcetkClient, "filesSharedWithUser", "forcetkClient");
        forcetkClient.fileDetails = promiser(innerForcetkClient, "fileDetails", "forcetkClient");
        forcetkClient.apexrest = promiser(innerForcetkClient, "apexrest", "forcetkClient");

        // Exposing outside
        Force.forcetkClient = forcetkClient;

        if (navigator.smartstore)
        {
            smartstoreClient = new Object();
            smartstoreClient.registerSoup = promiser(navigator.smartstore, "registerSoup", "smartstoreClient");
            smartstoreClient.upsertSoupEntriesWithExternalId = promiser(navigator.smartstore, "upsertSoupEntriesWithExternalId", "smartstoreClient");
            smartstoreClient.querySoup = promiser(navigator.smartstore, "querySoup", "smartstoreClient");
            smartstoreClient.runSmartQuery = promiser(navigator.smartstore, "runSmartQuery", "smartstoreClient");
            smartstoreClient.moveCursorToNextPage = promiser(navigator.smartstore, "moveCursorToNextPage", "smartstoreClient");
            smartstoreClient.removeFromSoup = promiser(navigator.smartstore, "removeFromSoup", "smartstoreClient");
            smartstoreClient.closeCursor = promiser(navigator.smartstore, "closeCursor", "smartstoreClient");
            smartstoreClient.soupExists = promiser(navigator.smartstore, "soupExists", "smartstoreClient");
            smartstoreClient.removeSoup = promiser(navigator.smartstore, "removeSoup", "smartstoreClient");
            smartstoreClient.retrieveSoupEntries = promiser(navigator.smartstore, "retrieveSoupEntries", "smartstoreClient");

            // Exposing outside
            Force.smartstoreClient = smartstoreClient;
        }
    };

    // Force.Error
    // -----------
    // Wrapper around rest errors or conflict errors
    // For rest errors, has fields: type with value RestError, xhr, status and details
    // For conflict errors, has fields: type with value ConflictError, base, theirs, yours, remoteChanges, localChanges, conflictingChanges (see syncRemoteObjectDetectConflict for details)
    //
    Force.Error = function(rawError) {
        // Rest error
        if (_.has(rawError, "responseText")) {
            // 200  “OK” success code, for GET or HEAD request.
            // 201  “Created” success code, for POST request.
            // 204  “No Content” success code, for DELETE request.
            // 300  The value returned when an external ID exists in more than one record. The response body contains the list of matching records.
            // 400  The request couldn’t be understood, usually because the JSON or XML body contains an error.
            // 401  The session ID or OAuth token used has expired or is invalid. The response body contains the message and errorCode.
            // 403  The request has been refused. Verify that the logged-in user has appropriate permissions.
            // 404  The requested resource couldn’t be found. Check the URI for errors, and verify that there are no sharing issues.
            // 405  The method specified in the Request-Line isn’t allowed for the resource specified in the URI.
            // 415  The entity in the request is in a format that’s not supported by the specified method.
            // 500  An error has occurred within Force.com, so the request couldn’t be completed. Contact salesforce.com Customer Support.
            this.type = "RestError";
            this.xhr = rawError;
            this.status = rawError.status;
            try {
                this.details = JSON.parse(rawError.responseText);
            }
            catch (e) {
                console.log("Could not parse responseText:" + e);
            }

        }
        // Conflict error
        else if (_.has(rawError, "remoteChanges")) {
            this.type = "ConflictError";
            _.extend(this, rawError);
        }
    };

    // Force.StoreCache
    // ----------------
    // SmartStore-backed cache
    // Soup elements are expected to have the boolean fields __locally_created__, __locally_updated__ and __locally_deleted__
    // A __local__ boolean field is added automatically on save
    // Index are created for keyField and __local__
    //
    Force.StoreCache = function(soupName, additionalIndexSpecs, keyField) {
        this.soupName = soupName;
        this.keyField = keyField || "Id";
        this.additionalIndexSpecs = additionalIndexSpecs || [];
    };

    _.extend(Force.StoreCache.prototype, {
        // Return promise which initializes backing soup
        init: function() {
            if (smartstoreClient == null) return;
            var indexSpecs = _.union([{path:this.keyField, type:"string"}, {path:"__local__", type:"string"}],
                                     this.additionalIndexSpecs);
            return smartstoreClient.registerSoup(this.soupName, indexSpecs);
        },

        // Return promise which retrieves cached value for the given key
        // When fieldlist is not null, the cached value is only returned when it has all the fields specified in fieldlist
        retrieve: function(key, fieldlist) {
            if (this.soupName == null) return;
            var that = this;
            var querySpec = navigator.smartstore.buildExactQuerySpec(this.keyField, key);
            var record = null;

            var hasFieldPath = function(soupElt, path) {
                var pathElements = path.split(".");
                var o = soupElt;
                for (var i = 0; i<pathElements.length; i++) {
                    var pathElement = pathElements[i];
                    if (!_.has(o, pathElement)) {
                        return false;
                    }
                    o = o[pathElement];
                }
                return true;
            };

            return smartstoreClient.querySoup(this.soupName, querySpec)
                .then(function(cursor) {
                    if (cursor.currentPageOrderedEntries.length == 1) record = cursor.currentPageOrderedEntries[0];
                    return smartstoreClient.closeCursor(cursor);
                })
                .then(function() {
                    // if the cached record doesn't have all the field we are interested in the return null
                    if (record != null && fieldlist != null && _.any(fieldlist, function(field) {
                        return !hasFieldPath(record, field);
                    })) {
                        console.log("----> In StoreCache:retrieve " + that.soupName + ":" + key + ":in cache but missing some fields");
                        record = null;
                    }
                    console.log("----> In StoreCache:retrieve " + that.soupName + ":" + key + ":" + (record == null ? "miss" : "hit"));
                    return record;
                });
        },

        // Return promise which stores a record in cache
        save: function(record, noMerge) {
            if (this.soupName == null) return;
            console.log("----> In StoreCache:save " + this.soupName + ":" + record[this.keyField] + " noMerge:" + (noMerge == true));

            var that = this;

            var mergeIfRequested = function() {
                if (noMerge) {
                    return $.when(record);
                }
                else {
                    return that.retrieve(record[that.keyField])
                        .then(function(oldRecord) {
                            return _.extend(oldRecord || {}, record);
                        });
                }
            };

            return mergeIfRequested()
                .then(function(record) {
                    record = that.addLocalFields(record);
                    return smartstoreClient.upsertSoupEntriesWithExternalId(that.soupName, [ record ], that.keyField)
                })
                .then(function(records) {
                    return records[0];
                });
        },

        // Return promise which stores several records in cache (NB: records are merged with existing records if any)
        saveAll: function(records, noMerge) {
            if (this.soupName == null) return;
            console.log("----> In StoreCache:saveAll records.length=" + records.length + " noMerge:" + (noMerge == true));

            var that = this;

            var mergeIfRequested = function() {
                if (noMerge) {
                    return $.when(records);
                }
                else {
                    if (_.any(records, function(record) { return !_.has(record, that.keyField); })) {
                        throw new Error("Can't merge without " + that.keyField);
                    }

                    var oldRecords = {};
                    var smartSql = "SELECT {" + that.soupName + ":_soup} "
                        + "FROM {" + that.soupName + "} "
                        + "WHERE {" + that.soupName + ":" + that.keyField + "} "
                        + "IN ('" + _.pluck(records, that.keyField).join("','") + "')";

                    var querySpec = navigator.smartstore.buildSmartQuerySpec(smartSql, records.length);

                    return smartstoreClient.runSmartQuery(querySpec)
                        .then(function(cursor) {
                            // smart query result will look like [[soupElt1], ...]
                            cursor.currentPageOrderedEntries = _.flatten(cursor.currentPageOrderedEntries);
                            _.each(cursor.currentPageOrderedEntries, function(oldRecord) {
                                oldRecords[oldRecord[that.keyField]] = oldRecord;
                            });
                            return smartstoreClient.closeCursor(cursor);
                        })
                        .then(function() {
                            return _.map(records, function(record) {
                                var oldRecord = oldRecords[record[that.keyField]];
                                return _.extend(oldRecord || {}, record)
                            });
                        });
                }
            };

            return mergeIfRequested()
                .then(function(records) {
                    records = _.map(records, function(record) {
                        return that.addLocalFields(record);
                    });

                    return smartstoreClient.upsertSoupEntriesWithExternalId(that.soupName, records, that.keyField);
                });
        },


        // Return promise On resolve the promise returns the object
        // {
        //   records: "all the fetched records",
        //   hasMore: "function to check if more records could be retrieved",
        //   getMore: "function to fetch more records",
        //   closeCursor: "function to close the open cursor and disable further fetch"
        // }
        // XXX we don't have totalSize
        find: function(querySpec) {
            var closeCursorIfNeeded = function(cursor) {
                if ((cursor.currentPageIndex + 1) == cursor.totalPages) {
                    return smartstoreClient.closeCursor(cursor).then(function() {
                        return cursor;
                    });
                }
                else {
                    return cursor;
                }
            }

            var buildQueryResponse = function(cursor) {
                return {
                    records: cursor.currentPageOrderedEntries,
                    hasMore: function() {
                        return cursor != null &&
                            (cursor.currentPageIndex + 1) < cursor.totalPages;
                    },

                    getMore: function() {
                        var that = this;
                        if (that.hasMore()) {
                            // Move cursor to the next page and update records property
                            return smartstoreClient.moveCursorToNextPage(cursor)
                            .then(closeCursorIfNeeded)
                            .then(function(c) {
                                cursor = c;
                                that.records = _.union(that.records, cursor.currentPageOrderedEntries);
                                return cursor.currentPageOrderedEntries;
                            });
                        }
                    },

                    closeCursor: function() {
                        return smartstoreClient.closeCursor(cursor)
                            .then(function() { cursor = null; });
                    }
                }
            };

            var runQuery = function(soupName, querySpec) {
                if (querySpec.queryType === "smart") {
                    return smartstoreClient.runSmartQuery(querySpec).then(function(cursor) {
                        // smart query result will look like [[soupElt1], ...]
                        cursor.currentPageOrderedEntries = _.flatten(cursor.currentPageOrderedEntries);
                        return cursor;
                    })
                }
                else {
                    return smartstoreClient.querySoup(soupName, querySpec)
                }
            }

            return runQuery(this.soupName, querySpec)
                .then(closeCursorIfNeeded)
                .then(buildQueryResponse);
        },

        // Return promise which deletes record from cache
        remove: function(key) {
            if (this.soupName == null) return;
            console.log("----> In StoreCache:remove " + this.soupName + ":" + key);
            var that = this;
            var querySpec = navigator.smartstore.buildExactQuerySpec(this.keyField, key);
            var soupEntryId = null;
            return smartstoreClient.querySoup(this.soupName, querySpec)
                .then(function(cursor) {
                    if (cursor.currentPageOrderedEntries.length == 1) {
                        soupEntryId = cursor.currentPageOrderedEntries[0]._soupEntryId;
                    }
                    return smartstoreClient.closeCursor(cursor);
                })
                .then(function() {
                    if (soupEntryId != null) {
                        return smartstoreClient.removeFromSoup(that.soupName, [ soupEntryId ])
                    }
                    return null;
                })
                .then(function() {
                    return null;
                });
        },

        // Return uuid for locally created entry
        makeLocalId: function() {
            return _.uniqueId("local_" + (new Date()).getTime());
        },

        // Return true if id was a locally made id
        isLocalId: function(id) {
            return id != null && id.indexOf("local_") == 0;
        },

        // Add __locally_*__ fields if missing and computed field __local__
        addLocalFields: function(record) {
            record = _.extend({__locally_created__: false, __locally_updated__: false, __locally_deleted__: false}, record);
            record.__local__ =  (record.__locally_created__ || record.__locally_updated__ || record.__locally_deleted__);
            return record;
        }
    });

    // Force.SObjectType
    // -----------------
    // Represent the meta-data of a SObject type on the client
    //
    Force.SObjectType = function (sobjectType, cache, cacheMode) {
        this.sobjectType = sobjectType;
        this.cache = cache;
        this._data = {};
        this._cacheSynced = true;
        this.cacheMode = cacheMode || Force.CACHE_MODE.SERVER_FIRST;
    };

    _.extend(Force.SObjectType.prototype, (function() {
        /*----- INTERNAL METHODS ------*/
        // Cache actions helper
        // Check first if cache exists and if data exists in cache.
        // Then update the current instance with data from cache.
        var cacheRetrieve = function(that, property) {
            // Always fetch from the cache again so as to obtain the
            // changes done to the cache by other instances of this SObjectType.
            var cacheMode = _.result(that, 'cacheMode');
            if (that.cache && (cacheMode == Force.CACHE_MODE.CACHE_ONLY ||
                cacheMode == Force.CACHE_MODE.CACHE_FIRST)) {
                return that.cache.retrieve(that.sobjectType)
                        .then(function(data) {
                            that._data[property] = data ? data[property] : null;
                            return that;
                        });
            } else return that;
        };

        // Check first if cache exists.
        // Then save the current instance data to cache.
        var cacheSave = function(that) {
            var cacheMode = _.result(that, 'cacheMode');
            if (!that._cacheSynced && that.cache && cacheMode != Force.CACHE_MODE.SERVER_ONLY) {
                that._data[that.cache.keyField] = that.sobjectType;
                return that.cache.save(that._data).then(function(){
                    that._cacheSynced = true;
                    return that;
                });
            } else return that;
        };

        // Check first if cache exists. If yes, then
        // clear any data from the cache for this sobject type.
        var cacheClear = function(that) {
            if (that.cache) {
                return that.cache.remove(that.sobjectType)
                            .then(function() { return that; });
            } else return that;
        };

        // Server action helper
        // If no describe data exists on the instance, get it from server.
        var serverDescribeUnlessCached = function(that) {
            var cacheMode = _.result(that, 'cacheMode');
            if(!that._data.describeResult && cacheMode != Force.CACHE_MODE.CACHE_ONLY) {
                return forcetkClient.describe(that.sobjectType)
                        .then(function(describeResult) {
                            that._data.describeResult = describeResult;
                            that._cacheSynced = false;
                            return that;
                        });
            } else return that;
        };

        // If no metadata data exists on the instance, get it from server.
        var serverMetadataUnlessCached = function(that) {
            var cacheMode = _.result(that, 'cacheMode');
            if(!that._data.metadataResult && cacheMode != Force.CACHE_MODE.CACHE_ONLY) {
                return forcetkClient.metadata(that.sobjectType)
                        .then(function(metadataResult) {
                            that._data.metadataResult = metadataResult;
                            that._cacheSynced = false;
                            return that;
                        });
            } else return that;
        };

        // If no layout data exists for this record type on the instance,
        // get it from server.
        var serverDescribeLayoutUnlessCached = function(that, recordTypeId) {
            var cacheMode = _.result(that, 'cacheMode');
            if(!that._data["layoutInfo_" + recordTypeId] && cacheMode != Force.CACHE_MODE.CACHE_ONLY) {
                return forcetkClient.describeLayout(that.sobjectType, recordTypeId)
                        .then(function(layoutResult) {
                            that._data["layoutInfo_" + recordTypeId] = layoutResult;
                            that._cacheSynced = false;
                            return that;
                        });
            } else return that;
        };

        /*----- EXTERNAL METHODS ------*/
        return {
            // Returns a promise, which once resolved
            // returns describe data of the sobject.
            describe: function() {
                var that = this;
                if (!that._data.describeResult) {
                    that._data.describeResult =  $.when(cacheRetrieve(that, "describeResult"))
                        .then(serverDescribeUnlessCached)
                        .then(cacheSave)
                        .then(function() {
                            return that._data.describeResult;
                        });
                }
                return $.when(that._data.describeResult);
            },
            // Returns a promise, which once resolved
            // returns metadata of the sobject.
            getMetadata: function() {
                var that = this;
                if (!that._data.metadataResult) {
                    that._data.metadataResult = $.when(cacheRetrieve(that, "metadataResult"))
                        .then(serverMetadataUnlessCached)
                        .then(cacheSave)
                        .then(function() {
                            return that._data.metadataResult;
                        });
                }
                return $.when(that._data.metadataResult);
            },
            // Returns a promise, which once resolved
            // returns layout information associated
            // to a particular record type.
            // @param recordTypeId (Default: 012000000000000AAA)
            describeLayout: function(recordTypeId) {
                var that = this;
                // Defaults to Record type id of Master
                if (!recordTypeId) recordTypeId = '012000000000000AAA';

                var layoutInfoId = "layoutInfo_" + recordTypeId;
                if (!that._data[layoutInfoId]) {
                    that._data[layoutInfoId] = $.when(cacheRetrieve(that, layoutInfoId), recordTypeId)
                        .then(serverDescribeLayoutUnlessCached)
                        .then(cacheSave)
                        .then(function() {
                            return that._data[layoutInfoId];
                        });
                }
                return $.when(that._data[layoutInfoId]);
            },
            // Returns a promise, which once resolved clears
            // the cached data for the current sobject type.
            reset: function() {
                var that = this;
                that._cacheSynced = true;
                that._data = {};
                return $.when(cacheClear(that));
            }
        }
    })());


    // Force.syncRemoteObjectWithCache
    // -------------------------------
    // Helper method to do any single record CRUD operation against cache
    // * method:<create, read, delete or update>
    // * id:<record id or null during create>
    // * attributes:<map field name to value>  record attributes given by a map of field name to value
    // * fieldlist:<fields>                    fields to fetch for read  otherwise full record is fetched, fields to save for update or create (required)
    // * cache:<cache object>                  cache into which  created/read/updated/deleted record are cached
    // * localAction:true|false                pass true if the change is done against the cache only (and has not been done against the server)
    //
    // Returns a promise
    //
    Force.syncRemoteObjectWithCache = function(method, id, attributes, fieldlist, cache, localAction) {
        console.log("---> In Force.syncRemoteObjectWithCache:method=" + method + " id=" + id);

        localAction = localAction || false;
        var isLocalId = cache.isLocalId(id);
        var targetedAttributes = (fieldlist == null ? attributes : (attributes == null ? null : _.pick(attributes, fieldlist)));

        // Cache actions helper
        var cacheCreate = function() {
            var data = _.extend(targetedAttributes,
                                {__locally_created__:localAction,
                                 __locally_updated__:false,
                                 __locally_deleted__:false});
            data[cache.keyField] = (localAction ? cache.makeLocalId() : id);
            return cache.save(data);
        };

        var cacheRead = function() {
            return cache.retrieve(id, fieldlist)
                .then(function(data) {
                    return data;
                });
        };

        var cacheUpdate = function() {
            var data = _.extend(targetedAttributes,
                                {__locally_created__: isLocalId,
                                 __locally_updated__: localAction,
                                 __locally_deleted__: false});
            data[cache.keyField] = id;
            return cache.save(data);
        };

        var cacheDelete = function() {
            if (!localAction || isLocalId) {
                return cache.remove(id);
            }
            else {
                var data = {__locally_deleted__:true};
                data[cache.keyField] = id;
                return cache.save(data)
                    .then(function() {
                        return null;
                    });
            }
        };

        // Chaining promises that return either a promise or created/upated/reda model attributes or null in the case of delete
        var promise = null;
        switch(method) {
        case "create": promise = cacheCreate(); break;
        case "read":   promise = cacheRead();   break;
        case "update": promise = cacheUpdate(); break;
        case "delete": promise = cacheDelete(); break;
        }

        return promise;
    };


    // Force.syncSObjectWithServer
    // ---------------------------
    // Helper method to do any single record CRUD operation against Salesforce server via REST API
    // * method:<create, read, delete or update>
    // * sobjectType:<record type>
    // * id:<record id or null during create>
    // * attributes:<map field name to value>  record attributes given by a map of field name to value
    // * fieldlist:<fields>                    fields to fetch for read, fields to save for update or create (required)
    //
    // Returns a promise
    //
    Force.syncSObjectWithServer = function(method, sobjectType, id, attributes, fieldlist) {
        console.log("---> In Force.syncSObjectWithServer:method=" + method + " id=" + id);

        // Server actions helper
        var serverCreate   = function() {
            var attributesToSave = _.pick(attributes, fieldlist);
            return forcetkClient.create(sobjectType, _.omit(attributesToSave, "Id"))
                .then(function(resp) {
                    return _.extend(attributes, {Id: resp.id});
                })
        };

        var serverRetrieve = function() {
            return forcetkClient.retrieve(sobjectType, id, fieldlist);
        };

        var serverUpdate   = function() {
            var attributesToSave = _.pick(attributes, fieldlist);
            return forcetkClient.update(sobjectType, id, _.omit(attributesToSave, "Id"))
                .then(function(resp) {
                    return attributes;
                })
        };

        var serverDelete   = function() {
            return forcetkClient.del(sobjectType, id)
                .then(function(resp) {
                    return null;
                })
        };

        // Chaining promises that return either a promise or created/upated/read model attributes or null in the case of delete
        var promise = null;
        switch(method) {
        case "create": promise = serverCreate(); break;
        case "read":   promise = serverRetrieve(); break;
        case "update": promise = serverUpdate(); break;
        case "delete": promise = serverDelete(); break; /* XXX on 404 (record already deleted) we should not fail otherwise cache won't get cleaned up */
        }

        return promise;

    };

    // Force.syncApexRestObjectWithServer
    // ----------------------------------
    // Helper method to do any single Apex Rest object CRUD operation against Salesforce server
    // * method:<create, read, delete or update>
    // * path:<apex rest resource path relative to /services/apexrest>
    // * idField:<id field>
    // * id:<record id or null during create>
    // * attributes:<map field name to value>  record attributes given by a map of field name to value
    // * fieldlist:<fields>                    fields to fetch for read, fields to save for update or create (required)
    //
    // Returns a promise
    //
    Force.syncApexRestObjectWithServer = function(method, path, id, idField, attributes, fieldlist) {
        console.log("---> In Force.syncApexRestObjectWithServer:method=" + method + " id=" + id);

        // Server actions helper
        var serverCreate   = function() {
            var attributesToSave = _.pick(attributes, fieldlist);
            return forcetkClient.apexrest(path, "POST", JSON.stringify(_.omit(attributesToSave, idField)), null)
                .then(function(resp) {
                    var idMap = {};
                    idMap[idField] = resp[idField];
                    return _.extend(attributes, idMap);
                })
        };

        var serverRetrieve = function() {
            var fields = fieldlist ? '?fields=' + fieldlist : '';
            return forcetkClient.apexrest(path + "/" + id + fields, "GET", null, null);
        };

        var serverUpdate   = function() {
            var attributesToSave = _.pick(attributes, fieldlist);
            return forcetkClient.apexrest(path + "/" + id, "PATCH", JSON.stringify(attributesToSave), null)
                .then(function(resp) {
                    return attributes;
                })
        };

        var serverDelete   = function() {
            return forcetkClient.apexrest(path + "/" + id, "DELETE", null, null)
                .then(function(resp) {
                    return null;
                })
        };

        // Chaining promises that return either a promise or created/upated/read model attributes or null in the case of delete
        var promise = null;
        switch(method) {
        case "create": promise = serverCreate(); break;
        case "read":   promise = serverRetrieve(); break;
        case "update": promise = serverUpdate(); break;
        case "delete": promise = serverDelete(); break;
        }

        return promise;

    };

    // Force.CACHE_MODE
    // -----------------
    // - SERVER_ONLY:  don't involve cache
    // - CACHE_FIRST:  don't involve server
    // - SERVER_ONLY:  during a read, the cache is queried first, and the server is only queried if the cache misses
    // - SERVER_FIRST: then the server is queried first and the cache is updated afterwards
    //
    Force.CACHE_MODE = {
        CACHE_ONLY: "cache-only",
        CACHE_FIRST: "cache-first",
        SERVER_ONLY: "server-only",
        SERVER_FIRST: "server-first"
    };

    // Force.syncRemoteObject
    // ---------------------
    // Combines syncWithServer (passed as argument) and Force.syncRemoteObjectWithCache
    // * cache:<cache object>
    // * cacheMode:<any Force.CACHE_MODE values>
    // * syncWithServer: function taking method, id, attributes, fieldlist arguments to do CRUD operation against a server (see Force.syncSObjectWithServer for an example)
    //
    // If cache is null, it simply syncWithServer
    // Otherwise behaves according to the cacheMode
    //
    // Returns a promise
    //
    //
    Force.syncRemoteObject = function(method, id, attributes, fieldlist, cache, cacheMode, info, syncWithServer) {
        console.log("--> In Force.syncRemoteObject:method=" + method + " id=" + id + " cacheMode=" + cacheMode);

        var cacheSync = function(method, id, attributes, fieldlist, localAction) {
            return Force.syncRemoteObjectWithCache(method, id, attributes, fieldlist, cache, localAction);
        };

        var serverSync = function(method, id) {
            return syncWithServer(method, id, attributes, fieldlist);
        };

        // Server only
        if (cache == null || cacheMode == Force.CACHE_MODE.SERVER_ONLY) {
            return serverSync(method, id);
        }

        // Cache only
        if (cache != null && cacheMode == Force.CACHE_MODE.CACHE_ONLY) {
            return cacheSync(method, id, attributes, null, true);
        }

        // Chaining promises that return either a promise or created/upated/reda model attributes or null in the case of delete
        var promise = null;

        // To keep track of whether data was read from cache or not
        info = info || {};
        info.wasReadFromCache = false;

        // Go to cache first
        if (cacheMode == Force.CACHE_MODE.CACHE_FIRST) {
            if (method == "create" || method == "update" || method == "delete") {
                throw new Error("Can't " + method + " with cacheMode " + cacheMode);
            }
            promise = cacheSync(method, id, attributes, fieldlist)
                .then(function(data) {
                    info.wasReadFromCache = (data != null);
                    if (!info.wasReadFromCache) {
                        // Not found in cache, go to server
                        return serverSync(method, id);
                    }
                    return data;
                });
        }
        // Go to server first
        else if (cacheMode == Force.CACHE_MODE.SERVER_FIRST || cacheMode == null /* no cacheMode specified means server-first */) {
            if (cache.isLocalId(id)) {
                if (method == "read" || method == "delete") {
                    throw new Error("Can't " + method + " on server for a locally created record");
                }

                // For locally created record, we need to do a create on the server
                var createdData;
                promise = serverSync("create", null)
                .then(function(data) {
                    createdData = data;
                    // Then we need to get rid of the local record with locally created id
                    return cacheSync("delete", id);
                })
                .then(function() {
                    return createdData;
                });
            }
            else {
                promise = serverSync(method, id);
            }
        }

        // Write back to cache if not read from cache
        promise = promise.then(function(data) {
            if (!info.wasReadFromCache) {
                var targetId = (method == "create" || cache.isLocalId(id) /* create as far as the server goes but update as far as the cache goes*/ ? data.Id : id);
                var targetMethod = (method == "read" ? "update" /* we want to write to the cache what was read from the server */: method);
                return cacheSync(targetMethod, targetId, data);
            }
            return data;
        });

        // Done
        return promise;
    };

    // Force.syncSObject
    // -----------------
    // Calls Force.syncRemoteObject using Force.syncSObjectWithServer to get the data from the server
    //
    // Returns a promise
    //
    //
    Force.syncSObject = function(method, sobjectType, id, attributes, fieldlist, cache, cacheMode, info) {
        console.log("--> In Force.syncSObject:method=" + method + " id=" + id + " cacheMode=" + cacheMode);

        var syncWithServer = function(method, id, attributes, fieldlist) {
            return Force.syncSObjectWithServer(method, sobjectType, id, attributes, fieldlist);
        };

        return Force.syncRemoteObject(method, id, attributes, fieldlist, cache, cacheMode, info, syncWithServer);
    };

    // Force.MERGE_MODE
    // -----------------
    //   If we call "theirs" the current server record, "yours" the locally modified record, "base" the server record that was originally fetched:
    //   - OVERWRITE               write "yours" back to server -- not checking "theirs" or "base"
    //   - MERGE_ACCEPT_YOURS      merge "theirs" and "yours" -- if the same field were changed locally and remotely, the local value is kept
    //   - MERGE_FAIL_IF_CONFLICT  merge "theirs" and "yours" -- if the same field were changed locally and remotely, the operation fails
    //   - MERGE_FAIL_IF_CHANGED   merge "theirs" and "yours" -- if any field were changed remotely, the operation fails
    //
    Force.MERGE_MODE = {
        OVERWRITE: "overwrite",
        MERGE_ACCEPT_YOURS: "merge-accept-yours",
        MERGE_FAIL_IF_CONFLICT: "merge-fail-if-conflict",
        MERGE_FAIL_IF_CHANGED: "merge-fail-if-changed"
    };

    // Force.syncRemoteObjectDetectConflict
    // ------------------------------------
    //
    // Helper method that adds conflict detection to syncRemoteObject
    // * cacheForOriginals:<cache object> cache where originally fetched SObject are stored
    // * mergeMode:<any Force.MERGE_MODE values>
    // * syncWithServer: function taking method, id, attributes, fieldlist arguments to do CRUD operation against a server (see Force.syncSObjectWithServer for an example)
    //
    // If cacheForOriginals is null, it simply calls syncRemoteObject
    // If cacheForOriginals is not null,
    // * on create, it calls Force.syncRemoteObject then stores a copy of the newly created record in cacheForOriginals
    // * on retrieve, it calls Force.syncRemoteObject then stores a copy of retrieved record in cacheForOriginals
    // * on update, it gets the current server record and compares it with the original cached locally, it then proceeds according to the merge mode
    // * on delete, it gets the current server record and compares it with the original cached locally, it then proceeds according to the merge mode
    //
    // Returns a promise
    // A rejected promise is returned if the server record has changed
    // {
    //   base: <originally fetched attributes>,
    //   theirs: <latest server attributes>,
    //   yours:<locally modified attributes>,
    //   remoteChanges:<fields changed between base and theirs>,
    //   localChanges:<fields changed between base and yours>
    //   conflictingChanges:<fields changed both in theirs and yours with different values>
    // }
    //
    Force.syncRemoteObjectDetectConflict = function(method, id, attributes, fieldlist, cache, cacheMode, cacheForOriginals, mergeMode, syncWithServer) {
        console.log("--> In Force.syncRemoteObjectDetectConflict:method=" + method + " id=" + id + " cacheMode=" + cacheMode + " mergeMode=" + mergeMode);

        // To keep track of whether data was read from cache or not
        var info = {};


        var syncRemoteObject = function(attributes) {
            return Force.syncRemoteObject(method, id, attributes, fieldlist, cache, cacheMode, info, syncWithServer);
        };

        var serverRetrieve = function() {
            return syncWithServer("read", id, null, fieldlist);
        };

        // Original cache required for conflict detection
        if (cacheForOriginals == null) {
            return syncRemoteObject(attributes);
        }

        // Original cache actions -- does nothing for local actions
        var cacheForOriginalsRetrieve = function(data) {
            return cacheForOriginals.retrieve(id);
        };

        var cacheForOriginalsSave = function(data) {
            return (cacheMode == Force.CACHE_MODE.CACHE_ONLY || data.__local__ /* locally changed: don't write to cacheForOriginals */
                    || (method == "read" && cacheMode == Force.CACHE_MODE.CACHE_FIRST && info.wasReadFromCache) /* read from cache: don't write to cacheForOriginals */)
                ? data
                : cacheForOriginals.save(data);
        };

        var cacheForOriginalsRemove = function() {
            return (cacheMode == Force.CACHE_MODE.CACHE_ONLY
                    ? null : cacheForOriginals.remove(id));
        };

        // Given two maps, return keys that are different
        var identifyChanges = function(attrs, otherAttrs) {
            return _.filter(_.intersection(fieldlist, _.union(_.keys(attrs), _.keys(otherAttrs))),
                            function(key) {
                                return (attrs[key] || "") != (otherAttrs[key] || ""); // treat "", undefined and null the same way
                            });
        };

        // When conflict is detected (according to mergeMode), the promise is failed, otherwise syncRemoteObject() is invoked
        var checkConflictAndSync = function() {
            var originalAttributes;

            // Merge mode is overwrite or local action or locally created -- no conflict check needed
            if (mergeMode == Force.MERGE_MODE.OVERWRITE || mergeMode == null /* no mergeMode specified means overwrite */
                || cacheMode == Force.CACHE_MODE.CACHE_ONLY
                || (cache != null && cache.isLocalId(id)))
            {
                return syncRemoteObject(attributes);
            }

            // Otherwise get original copy, get latest server and compare
            return cacheForOriginalsRetrieve()
                .then(function(data) {
                    originalAttributes = data;
                    return (originalAttributes == null ? null /* don't waste time going to server */: serverRetrieve());
                })
                .then(function(remoteAttributes) {
                    var shouldFail = false;

                    if (remoteAttributes == null || originalAttributes == null) {
                        return syncRemoteObject(attributes);
                    }
                    else {
                        var localChanges = identifyChanges(originalAttributes, attributes);
                        var localVsRemoteChanges = identifyChanges(attributes, remoteAttributes);
                        var remoteChanges = identifyChanges(originalAttributes, remoteAttributes);
                        var conflictingChanges = _.intersection(remoteChanges, localChanges, localVsRemoteChanges);
                        var nonConflictingRemoteChanges = _.difference(remoteChanges, conflictingChanges);

                        switch(mergeMode) {
                        case Force.MERGE_MODE.MERGE_ACCEPT_YOURS:     shouldFail = false; break;
                        case Force.MERGE_MODE.MERGE_FAIL_IF_CONFLICT: shouldFail = conflictingChanges.length > 0; break;
                        case Force.MERGE_MODE.MERGE_FAIL_IF_CHANGED:  shouldFail = remoteChanges.length > 0; break;
                        }
                        if (shouldFail) {
                            var conflictDetails = {base: originalAttributes, theirs: remoteAttributes, yours:attributes, remoteChanges:remoteChanges, localChanges:localChanges, conflictingChanges:conflictingChanges};
                            return $.Deferred().reject(conflictDetails);
                        }
                        else {
                            var mergedAttributes = _.extend(attributes, _.pick(remoteAttributes, nonConflictingRemoteChanges));
                            return syncRemoteObject(mergedAttributes);
                        }
                    }
                });
        };

        var promise = null;
        switch(method) {
        case "create": promise = syncRemoteObject(attributes).then(cacheForOriginalsSave); break;
        case "read":   promise = syncRemoteObject(attributes).then(cacheForOriginalsSave); break;
        case "update": promise = checkConflictAndSync().then(cacheForOriginalsSave); break;
        case "delete": promise = checkConflictAndSync().then(cacheForOriginalsRemove); break;
        }

        // Done
        return promise;
    };

    // Force.syncSObjectDetectConflict
    // -------------------------------
    // Calls Force.syncRemoteObjectDetectConflict using Force.syncSObjectWithServer to get the data from the server
    //
    // Returns a promise
    //
    //
    Force.syncSObjectDetectConflict = function(method, sobjectType, id, attributes, fieldlist, cache, cacheMode, cacheForOriginals, mergeMode) {
        console.log("--> In Force.syncSyncSObjectDetectConflict:method=" + method + " id=" + id + " cacheMode=" + cacheMode + " mergeMode=" + mergeMode);

        var syncWithServer = function(method, id, attributes, fieldlist) {
            return Force.syncSObjectWithServer(method, sobjectType, id, attributes, fieldlist);
        };

        return Force.syncRemoteObjectDetectConflict(method, id, attributes, fieldlist, cache, cacheMode, cacheForOriginals, mergeMode, syncWithServer);
    };

    // Force.fetchSObjectsFromServer
    // -----------------------------
    // Helper method to fetch a collection of SObjects from server, using SOQL, SOSL or MRU
    // * config: {type:"soql", query:"<soql query>"}
    //   or {type:"sosl", query:"<sosl query>"}
    //   or {type:"mru", sobjectType:"<sobject type>", fieldlist:"<fields to fetch>"[, orderBy:"<field to sort by>", orderDirection:"<ASC|DESC>"]}
    //
    // Return promise On resolve the promise returns the object
    // {
    //   totalSize: "total size of matched records",
    //   records: "all the fetched records",
    //   hasMore: "function to check if more records could be retrieved",
    //   getMore: "function to fetch more records",
    //   closeCursor: "function to close the open cursor and disable further fetch"
    // }
    //
    Force.fetchSObjectsFromServer = function(config) {
        console.log("---> In Force.fetchSObjectsFromServer:config=" + JSON.stringify(config));

        // Server actions helper
        var serverSoql = function(soql) {
            return forcetkClient.query(soql)
                .then(function(resp) {
                    var nextRecordsUrl = resp.nextRecordsUrl;
                    return {
                        totalSize: resp.totalSize,
                        records: resp.records,
                        hasMore: function() { return nextRecordsUrl != null; },
                        getMore: function() {
                            var that = this;
                            if (!nextRecordsUrl) return null;
                            return forcetkClient.queryMore(nextRecordsUrl).then(function(resp) {
                                nextRecordsUrl = resp.nextRecordsUrl;
                                that.records = _.union(that.records, resp.records);
                                return resp.records;
                            });
                        },
                        closeCursor: function() {
                            return $.when(function() { nextRecordsUrl = null; });
                        }
                    };
                });
        };

        var serverSosl = function(sosl) {
            return forcetkClient.search(sosl).then(function(resp) {
                return {
                    records: resp,
                    totalSize: resp.length,
                    hasMore: function() { return false; }
                }
            })
        };

        var serverMru = function(sobjectType, fieldlist, orderBy, orderDirection) {
            return forcetkClient.metadata(sobjectType)
                .then(function(resp) {
                    //Only do query if the fieldList is provided.
                    if (fieldlist) {
                        var soql = "SELECT " + fieldlist.join(",")
                            + " FROM " + sobjectType
                            + " WHERE Id IN ('" + _.pluck(resp.recentItems, "Id").join("','") + "')"
                            + (orderBy ? " ORDER BY " + orderBy : "")
                            + (orderDirection ? " " + orderDirection : "");
                        return serverSoql(soql);
                    } else return {
                        records: resp.recentItems,
                        totalSize: resp.recentItems.length,
                        hasMore: function() { return false; }
                    };
                });
        };

        var promise = null;
        switch(config.type) {
        case "soql": promise = serverSoql(config.query); break;
        case "sosl": promise = serverSosl(config.query); break;
        case "mru":  promise = serverMru(config.sobjectType, config.fieldlist, config.orderBy, config.orderDirection); break;
        // XXX what if we fall through the switch
        }

        return promise;
    };

    // Force.fetchApexRestObjectsFromServer
    // ------------------------------------
    // Helper method to fetch a collection of Apex Rest objects from server
    // * config: {apexRestPath:"<apex rest path>", params:<map of parameters for the query string>}
    //
    // The Apex Rest endpoint is expected to return a response of the form
    // {
    //   totalSize: <number of records returned>
    //   records: <all fetched records>
    //   nextRecordsUrl: <url to get next records or null>
    //
    // }
    //
    // Return promise On resolve the promise returns the object
    // {
    //   totalSize: "total size of matched records",
    //   records: "all the fetched records",
    //   hasMore: "function to check if more records could be retrieved",
    //   getMore: "function to fetch more records",
    //   closeCursor: "function to close the open cursor and disable further fetch"
    // }
    //
    Force.fetchApexRestObjectsFromServer = function(config) {
        console.log("---> In Force.fetchApexRestObjectsFromServer:config=" + JSON.stringify(config));

        // Server actions helper
        var serverFetch = function(apexRestPath) {
            var path = apexRestPath + "?" + $.param(config.params);
            return forcetkClient.apexrest(path, "GET", null, null)
                .then(function(resp) {
                    var nextRecordsUrl = resp.nextRecordsUrl;
                    return {
                        totalSize: resp.totalSize,
                        records: resp.records,
                        hasMore: function() { return nextRecordsUrl != null; },
                        getMore: function() {
                            var that = this;
                            if (!nextRecordsUrl) return null;
                            return forcetkClient.queryMore(nextRecordsUrl).then(function(resp) {
                                nextRecordsUrl = resp.nextRecordsUrl;
                                that.records = _.union(that.records, resp.records);
                                return resp.records;
                            });
                        },
                        closeCursor: function() {
                            return $.when(function() { nextRecordsUrl = null; });
                        }
                    };
                });
        };

        return serverFetch(config.apexRestPath, config.params);
    };

    // Force.fetchRemoteObjects
    // ------------------------
    // Helper method combining fetchFromServer and fetchFromCache (both passed in as arguments)
    // If cache is null, it simply calls fetchFromServer
    // If cache is not null and cacheMode is Force.CACHE_MODE.CACHE_ONLY then it simply calls fetchFromCache
    // Otherwise, the server is queried first and the cache is updated afterwards
    //
    // * fetchFromServer: function taking no arguments and fetching the remote objects from the server (see Force.fetchSObjectsFromServer for an example)
    // * fetchFromCache: function taking no arguments and fetching the remote objects from the cache
    //
    // Returns a promise
    //
    Force.fetchRemoteObjects = function(fetchFromServer, fetchFromCache, cacheMode, cache, cacheForOriginals) {
        console.log("--> In Force.fetchRemoteObjects:cacheMode=" + cacheMode);

        var promise;

        if (cache != null && cacheMode == Force.CACHE_MODE.CACHE_ONLY) {
            promise = fetchFromCache();

        } else {

            promise = fetchFromServer();

            if (cache != null) {

                var fetchResult;
                var processResult = function(resp) {
                    fetchResult = resp;
                    return resp.records;
                };

                var cacheSaveAll = function(records) {
                    return cache.saveAll(records);
                };

                var cacheForOriginalsSaveAll = function(records) {
                    return cacheForOriginals != null ? cacheForOriginals.saveAll(records) : records;
                };

                var setupGetMore = function(records) {
                    return _.extend(fetchResult,
                                    {
                                        records: records,
                                        getMore: function() {
                                            return fetchResult.getMore().then(cacheSaveAll).then(cacheForOriginalsSaveAll);
                                        }
                                    });
                };

                promise = promise
                    .then(processResult)
                    .then(cacheSaveAll)
                    .then(cacheForOriginalsSaveAll)
                    .then(setupGetMore);
            }
        }

        return promise;
    };


    // Force.fetchSObjects
    // -------------------
    // Calls Force.fetchRemoteObjects using Force.fetchSObjectsFromServer to get the data from the server
    //
    // Returns a promise
    //
    Force.fetchSObjects = function(config, cache, cacheForOriginals) {
        console.log("--> In Force.fetchSObjects:config.type=" + config.type);

        var fetchFromServer = function() {
            return Force.fetchSObjectsFromServer(config);
        };

        var fetchFromCache = function() {
            return cache.find(config.cacheQuery);
        };

        var cacheMode = (config.type == "cache" ? Force.CACHE_MODE.CACHE_ONLY : Force.CACHE_MODE.SERVER_FIRST);

        return Force.fetchRemoteObjects(fetchFromServer, fetchFromCache, cacheMode, cache, cacheForOriginals);
    };

    if (!_.isUndefined(Backbone)) {


        // Force.RemoteObject
        // ------------------
        // Abstract subclass of Backbone.Model to represent a remote object on the client
        //
        Force.RemoteObject = Backbone.Model.extend({
            // Used if none is passed during sync call - can be a string or a function taking the method and returning a string
            fieldlist:null,

            // Used if none is passed during sync call - can be a string or a function taking the method and returning a string
            cacheMode:null,

            // Used if none is passed during sync call - can be a string or a function taking the method and returning a string
            mergeMode:null,

            // Used if none is passed during sync call - can be a cache object or a function returning a cache object
            cache: null,

            // Used if none is passed during sync call - can be a cache object or a function returning a cache object
            cacheForOriginals: null,

            // To be defined in concrete subclass
            syncRemoteObjectWithServer: function(method, id, attributes, fieldlist) {
                return $.when([]);
            },

            // Overriding Backbone sync method (responsible for all server interactions)
            //
            // Extra options (can also be defined as properties of the model object)
            // * fieldlist:<array of fields> during read if you don't want to fetch the whole record, during save fields to save
            // * cache:<cache object>
            // * cacheMode:<any Force.CACHE_MODE values>
            // * cacheForOriginals:<cache object>
            // * mergeMode:<any Force.MERGE_MODE values>
            //
            sync: function(method, model, options) {
                var that = this;
                var resolveOption = function(optionName) {
                    return options[optionName] || (_.isFunction(that[optionName]) ? that[optionName](method) : that[optionName]);
                };

                console.log("-> In Force.RemoteObject:sync method=" + method + " model.id=" + model.id);

                var fieldlist         = resolveOption("fieldlist");
                var cacheMode         = resolveOption("cacheMode");
                var mergeMode         = resolveOption("mergeMode");
                var cache             = resolveOption("cache");
                var cacheForOriginals = resolveOption("cacheForOriginals");

                var syncWithServer = function(method, id, attributes, fieldlist) {
                    return that.syncRemoteObjectWithServer(method, id, attributes, fieldlist);
                };

                Force.syncRemoteObjectDetectConflict(method, model.id, model.attributes, fieldlist, cache, cacheMode, cacheForOriginals, mergeMode, syncWithServer)
                    .done(options.success)
                    .fail(options.error);
            }
        });


        // Force.SObject
        // --------------
        // Subclass of Force.RemoteObject to represent a SObject on the client (fetch/save/delete update server through the REST API and or cache)
        //
        Force.SObject = Force.RemoteObject.extend({
            // sobjectType is expected on every instance
            sobjectType:null,

            // Id is the id attribute
            idAttribute: 'Id',

            syncRemoteObjectWithServer: function(method, id, attributes, fieldlist) {
                return Force.syncSObjectWithServer(method, this.sobjectType, id, attributes, fieldlist);
            }
        });

        // Force.ApexRestObject
        // --------------------
        // Subclass of Force.RemoteObject to represent a Apex Rest object on the client (fetch/save/delete update server through the Apex Rest API and or cache)
        //
        Force.ApexRestObject = Force.RemoteObject.extend({
            // apexRestPath is expected on every instance
            apexRestPath:null,

            // Id is the id attribute
            idAttribute: 'Id',

            syncRemoteObjectWithServer: function(method, id, attributes, fieldlist) {
                return Force.syncApexRestObjectWithServer(method, this.apexRestPath, id, this.idAttribute, attributes, fieldlist);
            }
        });


        // Force.RemoteObjectCollection
        // ----------------------------
        // Abstract subclass of Backbone.Collection to represent a collection of remote objects on the client.
        // Only fetch is supported (no create/update or delete).
        // To define the set of remote object to fetch, provide a implementation for the method fetchRemoteObjectFromServer
        // Where the config is
        // config: {type:"cache", cacheQuery:<cache query>[, closeCursorImmediate:<true|false(default)>]} or something else understood by the fetchRemoteObjectFromServer method of your subclass
        Force.RemoteObjectCollection = Backbone.Collection.extend({
            // To be defined in concrete subclass
            model: null,

            // Used if none is passed during sync call - can be a cache object or a function returning a cache object
            cache: null,

            // Used if none is passed during sync call - can be a cache object or a function returning a cache object
            cacheForOriginals: null,

            // To be defined in concrete subclass
            fetchRemoteObjectFromServer: function(config) {
                return $.when([]);
            },

            // Method to fetch remote objects from cache
            fetchRemoteObjectsFromCache: function(cache, cacheQuery) {
                return cache.find(cacheQuery);
            },

            // Method to check if the current collection has more data to fetch
            hasMore: function() {
                return this._fetchResponse ? this._fetchResponse.hasMore() : false;
            },

            // Method to fetch more records if there's an open cursor
            getMore: function() {
                var that = this;
                if (that.hasMore())
                    return that._fetchResponse.getMore()
                        .then(function(records) {
                            that.add(records);
                            return records;
                        });
                else return $.when([]);
            },

            // Close any open cursors to fetch more records.
            closeCursor: function() {
                return $.when(!this.hasMore() || that._fetchResponse.closeCursor());
            },

            // Overriding Backbone sync method (responsible for all server interactions)
            // Extra options (can also be defined as properties of the model object)
            // * config:<see above for details>
            // * cache:<cache object>
            sync: function(method, model, options) {
                console.log("-> In Force.RemoteObjectCollection:sync method=" + method);
                var that = this;

                if (method != "read") {
                    throw new Error("Method " + method  + " not supported");
                }

                var config = options.config || _.result(this, "config");
                var cache = options.cache   || _.result(this, "cache");
                var cacheForOriginals = options.cacheForOriginals || _.result(this, "cacheForOriginals");

                if (config == null) {
                    options.success([]);
                    return;
                }

                var fetchFromServer = function() {
                    return that.fetchRemoteObjectsFromServer(config);
                };

                var fetchFromCache = function() {
                    return that.fetchRemoteObjectsFromCache(cache, config.cacheQuery);
                };

                var cacheMode = (config.type == "cache" ? Force.CACHE_MODE.CACHE_ONLY : Force.CACHE_MODE.SERVER_FIRST);

                options.reset = true;
                Force.fetchRemoteObjects(fetchFromServer, fetchFromCache, cacheMode, cache, cacheForOriginals)
                    .then(function(resp) {
                        that._fetchResponse = resp;
                        if (config.closeCursorImmediate) that.closeCursor();
                        return resp.records;
                    })
                    .done(options.success)
                    .fail(options.error);
            },

            // Overriding Backbone parse method (responsible for parsing server response)
            parse: function(resp, options) {
                var that = this;
                return _.map(resp, function(result) {
                    var remoteObject = new that.model(result);
                    return remoteObject;
                });
            }
        });

        // Force.SObjectCollection
        // -----------------------
        // Subclass of Force.RemoteObjectCollection to represent a collection of SObject's on the client.
        // Only fetch is supported (no create/update or delete).
        // To define the set of SObject's to fetch pass an options.config or set the config property on this collection object.
        // Where the config is
        // config: {type:"soql", query:"<soql query>"}
        //   or {type:"sosl", query:"<sosl query>"}
        //   or {type:"mru", sobjectType:"<sobject type>", fieldlist:"<fields to fetch>"[, orderBy:"<field to sort by>", orderDirection:"<ASC|DESC>"]}
        //   or {type:"cache", cacheQuery:<cache query>[, closeCursorImmediate:<true|false(default)>]}
        //
        Force.SObjectCollection = Force.RemoteObjectCollection.extend({
            model: Force.SObject,

            fetchRemoteObjectsFromServer: function(config) {
                return Force.fetchSObjectsFromServer(config);
            },

            // Overriding Backbone parse method (responsible for parsing server response)
            parse: function(resp, options) {
                var that = this;
                return _.map(resp, function(result) {
                    var sobjectType = result.attributes.type;
                    var sobject = new that.model(result);
                    sobject.sobjectType = sobjectType;
                    return sobject;
                });
            }
        });


        // Force.ApexRestObjectCollection
        // ------------------------------
        // Subclass of Force.RemoteObjectCollection to represent a collection of Apex Rest object's on the client.
        // Only fetch is supported (no create/update or delete).
        // To define the set of Apex rRest's to fetch pass an options.config or set the config property on this collection object.
        // Where the config is
        // config: {apexRestPath:"<apex rest path>", params:<map of parameters for the query string>}
        //   or {type:"cache", cacheQuery:<cache query>[, closeCursorImmediate:<true|false(default)>]}
        //
        // The Apex Rest endpoint is expected to return a response of the form
        // {
        //   totalSize: <number of records returned>
        //   records: <all fetched records>
        //   nextRecordsUrl: <url to get next records or null>
        //
        // }
        //
        Force.ApexRestObjectCollection = Force.RemoteObjectCollection.extend({
            model: Force.ApexRestObject,

            fetchRemoteObjectsFromServer: function(config) {
                return Force.fetchApexRestObjectsFromServer(config);
            }
        });


    } // if (!_.isUndefined(Backbone)) {
})
.call(this, jQuery, _, Backbone, forcetk);
