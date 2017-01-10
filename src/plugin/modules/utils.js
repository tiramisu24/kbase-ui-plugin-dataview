/*global define*/
/*jslint white:true,browser:true */
define([
    'bluebird',
    'kb_service/utils',
    'kb_service/client/workspace'
], function (Promise, apiUtils, Workspace) {
    function getObjectInfo(runtime, params) {
        return Promise.try(function () {
            var workspaceId = params.workspaceId,
                objectId = params.objectId,
                objectVersion = params.objectVersion;

            if (workspaceId === undefined) {
                throw new Error('Workspace id or name is required');
            }
            if (objectId === undefined) {
                throw new Error('Object id or name is required');
            }

            var objectRef = apiUtils.makeWorkspaceObjectRef(workspaceId, objectId, objectVersion),
                workspaceClient = new Workspace(runtime.config('services.workspace.url'), {
                    token: runtime.service('session').getAuthToken()
                });

            return workspaceClient.get_object_info_new({
                objects: [{ref: objectRef}],
                ignoreErrors: 1
            })
                .then(function (objectList) {
                    if (objectList.length === 0) {
                        throw new Error('Object not found: ' + objectRef);
                    }
                    if (objectList.length > 1) {
                        throw new Error('Too many objects found: ' + objectRef + ', ' + objectList.length);
                    }
                    if (objectList[0] === null) {
                        throw new Error('Object not found with reference ' + objectRef);
                    }
                    return apiUtils.object_info_to_object(objectList[0]);
                });
        });
    }
    function getObject(runtime, params) {
        return Promise.try(function () {
            var workspaceId = params.workspaceId,
                objectId = params.objectId,
                objectVersion = params.objectVersion;

            if (workspaceId === undefined) {
                throw new Error('Workspace id or name is required');
            }
            if (objectId === undefined) {
                throw new Error('Object id or name is required');
            }

            var objectRef = apiUtils.makeWorkspaceObjectRef(workspaceId, objectId, objectVersion),
                workspaceClient = new Workspace(runtime.config('services.workspace.url'), {
                    token: runtime.service('session').getAuthToken()
                });

            return workspaceClient.get_objects([{ref: objectRef}])
                .then(function (objectList) {
                    if (objectList.length === 0) {
                        throw new Error('Object not found: ' + objectRef);
                    }
                    if (objectList.length > 1) {
                        throw new Error('Too many objects found: ' + objectRef + ', ' + objectList.length);
                    }
                    if (objectList[0] === null) {
                        throw new Error('Object not found with reference ' + objectRef);
                    }
                    return objectList[0];
                });
        });
    }

    return {
        getObjectInfo: getObjectInfo,
        getObject: getObject
    };
});