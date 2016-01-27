/*global define*/
/*jslint white:true,browser:true */
define([
    'numeral',
    'kb/common/html',
    'kb/common/dom',
    'plugins/dataview/modules/places',
    'yaml!plugins/dataview/modules/widgets/download/typeSupport.yml',
    'kb/service/client/workspace',
    'kb/service/client/transform',
    'kb/service/client/userAndJobState',
    'kb/service/utils',
    'plugins/dataview/modules/poller'
], function (numeral, html, dom, Places, typeSupport, WorkspaceClient, TransformClient, UserAndJobState, apiUtils, Poller) {
    'use strict';
    function factory(config) {
        var parent, container, runtime = config.runtime,
            tag = html.tag, a = tag('a'),
            div = tag('div'), button = tag('button'), label = tag('label'), input = tag('input'),
            table = tag('table'), tr = tag('tr'), td = tag('td'), th = tag('th'), p = tag('p'),
            form = tag('form'),
            span = tag('span'),
            places = Places.make({
                root: container
            }),
            toggleState = 'hidden',
            poller = Poller.make({interval: 1000}),
            state = {
                downloads: {}
            };

        // Renderers

        function renderLayout() {
            return div({class: 'hidden', id: places.add('main')}, [
                div({class: 'panel panel-primary'}, [
                    div({class: 'panel-heading'}, [
                        span({class: 'panel-title', id: places.add('title')}, 'Transform and Download Data Object')
                    ]),                    
                    div({class: 'panel-body'}, [
                        div({class: 'container-fluid'}, [
                            div({class: 'col-md-12'}, [
                                p([
                                    'This tool allows you to convert this data object to one or more output formats and download the resulting file.'
                                ]),
                                p({id: places.add('comment')})
                            ]),
                            div({class: 'col-md-12'}, [span({id: places.add('content')})]),
                            div({class: 'col-md-12', style: {marginTop: '1em'}}, [
                                div({class: 'panel panel-default'}, [
                                    div({class: 'panel-heading'}, [
                                        div({class: 'panel-title'}, 'Requested Transforms')
                                    ]),
                                    div({class: 'panel-body'}, [
                                        div({id: places.add('downloads')})
                                    ])
                                ])                                
                            ])                            
                        ])
                    ])
                ])
            ]);
        }
        var layout = renderLayout();
        
        function renderElapsed(elapsed) {
            if (elapsed === undefined) {
                return '';
            } 
            return numeral(elapsed).format('00:00:00');
        }
        
        function renderDownloadButton(url) {
            if (url === undefined) {
                return '';
            }
            return span([
                a({class: 'btn btn-primary', href: url, target: '_self'}, 'Download File')
            ]);
        }

        function renderDownloads() {
            var content = table({class: 'table table-bordered', style: {width: '100%'}}, [
                tr([th({width: '20%'}, 'Format'), 
                    th({width: '10%'},'Requested?'), 
                    th({width: '10%'},'Completed?'), 
                    th({width: '10%'},'Available?'), 
                    th({width: '10%'},'Error?'), 
                    th({width: '10%'},'Elapsed'), 
                    th({width: '10%'},'Download'), 
                    th({width: '20%'},'Message')]),
                Object.keys(state.downloads).map(function (key) {
                    var download = state.downloads[key],
                        formatName = state.downloadConfig[download.formatId].name;

                    return tr([
                        td(formatName),
                        td(download.requested ? 'Y' : 'n'),
                        td(download.completed ? 'Y' : 'n'),
                        td(download.available ? 'Y' : 'n'),
                        td(download.error ? 'ERROR' : ''),
                        td(renderElapsed(download.elapsed)),
                        td(renderDownloadButton(download.url)),
                        td(download.message || '')]);
                }).join('')
            ]);
            places.setContent('downloads', content);
        }

        function renderDownloadForm(downloadConfig) {
            var content = form([
                table([
                    tr([
                        td('Transform to: '),
                        td(span({class: 'kb-btn-group', dataToggle: 'buttons'},
                            downloadConfig.map(function (downloader, i) {
                                return label({class: 'kb-checkbox-control'}, [
                                    input({type: 'checkbox', autocomplete: 'off', checked: false, value: String(i)}),
                                    downloader.name

                                ]);
                            }).join(' ')))
                    ]),
                    tr([
                        td(),
                        td([
                            div({class: 'btn-toolbar', role: 'toolbar'}, [
                                div({class: 'btn-group', role: 'group'},
                                    button({class: 'btn btn-primary', dataButton: 'download'}, 'Transform'))
//                                    ,
//                                div({class: 'btn-group', role: 'group'},
//                                    button({class: 'btn btn-danger', dataButton: 'cancel'}, 'Cancel'))
                            ])
                        ])
                    ])
                ])
            ]),
                events = [
                    {
                        type: 'click',
                        selector: '[data-button="download"]',
                        listener: function (e) {
                            e.preventDefault();
                            doDownload();
                        }
                    },
//                    {
//                        type: 'click',
//                        selector: '[data-button="cancel"]',
//                        listener: function (e) {
//                            e.preventDefault();
//                            alert('canceling...');
//                        }
//
//                    },
                    {
                        type: 'change',
                        selector: 'input',
                        listener: function (e) {
                            var value = e.target.value;
                            if (e.target.checked) {
                                state.downloads[value] = {
                                    formatId: parseInt(value),
                                    requested: false,
                                    completed: false,
                                    available: false
                                };
                            } else {
                                delete state.downloads[value];
                            }
                            renderDownloads();
                        }
                    }
                ];
            return {
                content: content,
                events: events
            };
        }

        function show() {
            var node = places.getNode('main');
            node.classList.remove('hidden');
            return true;
        }

        function hide() {
            var node = places.getNode('main');
            node.classList.add('hidden');
            return true;
        }

        function toggle() {
            switch (toggleState) {
                case 'hidden':
                    show();
                    toggleState = 'showing';
                    break;
                case 'showing':
                    hide();
                    toggleState = 'hidden';
                    break;
            }
        }

        // Downloader stuff

        function parseShockNode(shockNodeId) {
            var parts = shockNodeId.split('/');
            if (parts.length > 1) {
                shockNodeId = parts[parts.length - 1];
            }
            parts = shockNodeId.split('?');
            if (parts.length > 0) {
                shockNodeId = parts[0];
            }
            return shockNodeId;
        }

        function encodeQuery(query) {
            return Object.keys(query).map(function (key) {
                return [key, String(query[key])].map(function (element) {
                    return encodeURIComponent(element);
                }).join('=');
            }).join('&');
        }

        function downloadFile(url) {
            // window.open(url, '_self');


//            var id = html.genId(),
//                iframe = document.createElement('iframe');
//            console.log('about to append iframe...');
//            document.body.appendChild(iframe);
//            iframe.id = id;
//            iframe.style.display = 'none';
//            iframe.src = url;
//            console.log('should be downloading about right now...');
//            iframe.onload = function () {
//                // document.removeChild(iframe);
//                console.log('I guess not!');
//            };
        }

        function downloadUjsResults(ujsResults, workspaceObjectName, unzip) {
            var shockNodeId = parseShockNode(ujsResults.shocknodes[0]),
                url = runtime.getConfig('services.data_import_export.url') + '/download',
                query = {
                    id: shockNodeId,
                    token: runtime.service('session').getAuthToken(),
                    del: 1
                };
            if (unzip) {
                query.unzip = unzip;
            } else {
                query.name = workspaceObjectName + '.zip';
            }
            if (ujsResults.remoteShockUrl) {
                query.url = ujsResults.remoteShockUrl;
            }
            var downloadUrl = url + '?' + encodeQuery(query);
            downloadFile(downloadUrl);
            return downloadUrl;
        }

        function transformAndDownload(download) {
            var downloadSpec = state.downloadConfig[download.formatId],
                args = {
                    external_type: downloadSpec.external_type,
                    kbase_type: state.type,
                    workspace_name: state.params.objectInfo.ws,
                    object_name: state.params.objectInfo.name,
                    optional_arguments: {
                        transform: downloadSpec.transform_options
                    }
                },
            nameSuffix = '.' + downloadSpec.name.replace(/[^a-zA-Z0-9|\.\-_]/g, '_'),
                transformClient = new TransformClient(runtime.getConfig('services.transform.url'), {
                    token: runtime.service('session').getAuthToken()
                }),
                workspaceObjectName = state.params.objectInfo.name + nameSuffix;

            transformClient.download(args)
                .then(function (downloadResult) {
                    var jobId = downloadResult[1];
                    download.jobId = jobId;
                    download.requested = true;
                    download.message = 'Requested transform of this object...';
                    renderDownloads();

                    var jobs = new UserAndJobState(runtime.getConfig('services.user_job_state.url'), {
                        token: runtime.service('session').getAuthToken()
                    });

                    // var jobs2 = new UserAndJobState(runtime.getConfig('https://kbase.us/services/transform'), {
                    //    token: runtime.service('session').getAuthToken()
                    //});

                    poller.addTask({
                        timeout: 300000,
                        isCompleted: function (elapsed) {
                            return jobs.get_job_status(jobId)
                                .then(function (data) {
                                    var status = data[2],
                                        complete = data[5],
                                        wasError = data[6];
                                    if (complete === 1) {
                                        if (wasError === 0) {
                                            return true;
                                        }
                                        throw new Error(status);
                                    }
                                    download.elapsed = elapsed/1000;
                                    download.message = 'Waiting...';
                                    renderDownloads();
                                    return false;
                                })
                                .catch(function (err) {

                                    //jobs.list_jobs()
                                    //    .then(function (jobs) {
                                    //        console.log('JOBS');
                                    //        console.log(jobs);
                                    //    });
                                    throw err;
                                });
                        },
                        whenCompleted: function () {
                            return jobs.get_results(jobId)
                                .then(function (ujsResults) {
                                    download.completed = true;
                                    // download.message = 'Conversion to format completed, downloading...';

                                    var url = downloadUjsResults(ujsResults, workspaceObjectName, downloadSpec.unzip);
                                    download.url = url;
                                    download.message = 'ready';                                    
                                    download.available = true;

                                    renderDownloads();
                                });
                        },
                        whenTimedOut: function (elapsed) {
                            download.error = true;
                            download.message = 'Timed out after ' + elapsed / 1000 + ' seconds';
                            renderDownloads();
                        },
                        whenError: function (err) {
                            download.error = true;
                            var msg;
                            if (err.message) {
                                msg = err.message;
                            } else if (err.error.message) {
                                msg = err.error.message;
                            } else {
                                msg = 'Unknown error';
                            }
                            download.message = msg;
                            renderDownloads();
                            // us.kbase.userandjobstate.jobstate.exceptions.NoSuchJobException
                        }
                    });
                })
                .catch(function (err) {
                    download.error = true;
                    var msg;
                    if (err.message) {
                        msg = err.message;
                    } else if (err.error.message) {
                        msg = err.error.message;
                    } else {
                        msg = 'Unknown error';
                    }
                    download.message = msg;
                    renderDownloads();
                });
        }

        function downloadFromWorkspace(workspaceName, objectName, workspaceUrl) {
            var url = runtime.getConfig('services.data_import_export.url') + '/download',
                query = {
                    ws: workspaceName,
                    id: objectName,
                    token: runtime.service('session').getAuthToken(),
                    url: workspaceUrl,
                    name: objectName + '.JSON.zip',
                    wszip: 1
                },
            downloadUrl = url + '?' + encodeQuery(query);
            downloadFile(downloadUrl);
            return downloadUrl;
        }

        function justDownload(download) {
            download.requested = true;
            download.completed = true;
            download.available = true;
            var url = downloadFromWorkspace(state.params.objectInfo.ws, state.params.objectInfo.name, runtime.getConfig('services.workspace.url'));
            download.url = url;
            download.message = 'ready';
            renderDownloads();
        }

        function doDownload() {
            // gather the selected download types.
            Object.keys(state.downloads).forEach(function (id) {
                var download = state.downloads[id],
                    downloadSpec = state.downloadConfig[download.formatId];
                if (downloadSpec.name === 'JSON') {
                    justDownload(download);
                } else {
                    transformAndDownload(download);
                }
            });
        }

        // API

        function init(config) {
        }

        function attach(node) {
            parent = node;
            container = node.appendChild(document.createElement('div'));
        }

        function getRef(params) {
            var ref = params.objectInfo.ws + '/' + params.objectInfo.name;
            if (params.objectInfo.version) {
                ref += '/' + params.objectInfo.version;
            }
            return ref;
        }

        function setErrorMessage(message) {
            places.setContent('content', message);
        }

        function qsa(node, selector) {
            if (selector === undefined) {
                selector = node;
                node = document;
            }
            var result = node.querySelectorAll(selector);
            if (result === null) {
                return [];
            }
            return Array.prototype.slice.call(result);
        }

        function ingestParams(params) {
            // TODO: validate
            state.params = params;
        }

        function start(params) {
            ingestParams(params);
            container.innerHTML = layout;

            // listen for events
            runtime.recv('downloadWidget', 'toggle', function () {
                toggle();
            });
        }

        function run(params) {
            // We can instantiate the widget as soon as we are started or run,
            // because the params passed to the page are good enough for
            // us to get started with.
            // TODO: the main panel could/should already have pulled down the 
            // basic object info, so in theory we could ask the parent widget
            // for the object info.
            var workspace = new WorkspaceClient(runtime.getConfig('services.workspace.url'), {
                token: runtime.service('session').getAuthToken()
            }),
                ref = getRef(params);
            return workspace.get_object_info_new({
                objects: [{ref: ref}],
                ignoreErrors: 1
            })
                .then(function (objectInfoArray) {
                    if (objectInfoArray.length === 0) {
                        throw new Error('No object found with ref ' + ref);
                    }
                    if (objectInfoArray.length > 1) {
                        throw new Error('Too many objects returned for ref ' + ref);
                    }
                    var objectInfo = apiUtils.object_info_to_object(objectInfoArray[0]),
                        type = objectInfo.typeModule + '.' + objectInfo.typeName,
                        typeDownloadConfig = typeSupport.types[type];

                    // We use a little state object to stash away things.
                    state.type = type;
                    
                    if (typeDownloadConfig === undefined) {
                        //setErrorMessage('Download not supported for this type: ' + type);
                        //console.log(objectInfo);
                       // return;
                       places.setContent('comment', 'This object type does not support Transform conversions, but the default JSON format is available.');
                       typeDownloadConfig = [];
                    }

                    var downloadConfig = typeDownloadConfig.concat({
                        name: 'JSON',
                        external_type: 'JSON.JSON',
                        transform_options: {}
                    });

                    state.downloadConfig = downloadConfig;

                    var form = renderDownloadForm(downloadConfig);

                    places.setContent('content', form.content);

                    form.events.forEach(function (event) {
                        var nodes = qsa(places.getNode('content'), event.selector);
                        nodes.forEach(function (node) {
                            node.addEventListener(event.type, event.listener);
                        });
                    });

                });
        }

        function stop() {
            // remove event listeners
        }

        function detach() {
            if (container) {
                parent.removeChild(container);
            }
        }

        function destroy() {
            // ??
        }

        return {
            init: init,
            attach: attach,
            start: start,
            run: run,
            stop: stop,
            detach: detach,
            destroy: destroy
        };
    }
    return {
        make: function (config) {
            return factory(config);
        }
    };
});