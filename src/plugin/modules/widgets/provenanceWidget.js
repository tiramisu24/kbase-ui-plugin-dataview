/*global define */
/*jslint browser: true, white: true */
define([
    'bluebird',
    'jquery',
    'd3',
    'kb_common/html',
    'kb_common/dom',
    'kb_service/client/workspace',
    'kb_common/jsonRpc/genericClient',
    'bootstrap',
    'd3_sankey'


],
    function (Promise, $, d3, html, dom, Workspace, GenericClient,Bootstrap) {
        'use strict';
        function widget(config) {

            var mount, container, $container, runtime = config.runtime,
                workspaceId, objectId,
                needColorKey = true,
                workspace = new Workspace(runtime.getConfig('services.workspace.url'), {
                    token: runtime.service('session').getAuthToken()
                }),
                client = new GenericClient({
                    url: runtime.config('services.workspace.url'),
                    token: runtime.service('session').getAuthToken(),
                    module: 'Workspace'
                }),
                lineWidth = 4,
                objWidth= 20,
                types = {
                    selected: {
                        color: '#FF9800',
                        name: 'Current object',
                        width: objWidth,
                        stroke: (10,0)                    },
                    core: {
                        color: '#FF9800',
                        name: 'No Provenance or Dependencies',
                        width: objWidth,
                        stroke: (10,0)
                    },
                    ref: {
                        color: '#C62828',
                        name: 'Nodes with Provenance or Dependencies',
                        width: objWidth,
                        stroke: (10,0)
                    },
                    included: {
                        color: '#2196F3',
                        name: 'Dependencies Refereneces',
                        width: lineWidth,
                        stroke: (5, 5)
                    },
                    none: {
                        color: 'grey',
                        name: 'Provenance References',
                        width: lineWidth,
                        stroke: (3, 7)
                    },
                    copied: {
                        color: '#4BB856',
                        name: 'Copied From',
                        width: lineWidth,
                        stroke: (10,0)
                    }
                },
                monthLookup = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
                objIdtoDataRef = {
                  "-1" : 1
                },
                objIdtoDataProv = {
                  "-1" : 1
                },
                referenceGraph = {
                    nodes:[],
                    links:[]
                },
                provenanceGraph = {
                    nodes: [],
                    links: []
                },
                nodePaths = {

                },
                div = html.tag('div'),
                br = html.tag('br'),
                table = html.tag('table'),
                tr = html.tag('tr'),
                td = html.tag('td'),
                svg = html.tag('svg'),
                rect = html.tag('rect'),
                b = html.tag('b');

            // config settings?
            config.width = 1200;
            config.height = 700;

            function renderLayout() {
                return div([
                    div(['This is a visualization of the relationships between this piece of data and other data in KBase.  Click objects to show additional information (shown below the graph). Double click on an object expand graph.', br(), br()]),
                    div({id: 'objgraphview', style: {overflow: 'auto', height: '450px', resize: 'vertical'}}),
                    div({id: 'nodeColorKey'})
                ]);
            }

             /* Construct an ObjectIdentity that can be used to query the WS*/
            function getObjectIdentity(wsNameOrId, objNameOrId, objVer) {
                if (objVer) {
                    return {ref: wsNameOrId + "/" + objNameOrId + "/" + objVer};
                }
                return {ref: wsNameOrId + "/" + objNameOrId};
            }
            function getObjectRefShort(objectInfo) {
                return [objectInfo[6], objectInfo[0]].join('/');
            }
            function getObjectRef(objectInfo) {
                return [objectInfo[6], objectInfo[0], objectInfo[4]].join('/');
            }
            // edited from: http://stackoverflow.com/questions/3177836/how-to-format-time-since-xxx-e-g-4-minutes-ago-similar-to-stack-exchange-site
            function getTimeStampStr(objInfoTimeStamp) {
                if (!objInfoTimeStamp) {
                    return '';
                }
                var date = new Date(objInfoTimeStamp);
                var seconds = Math.floor((new Date() - date) / 1000);

                // f-ing safari, need to add extra ':' delimiter to parse the timestamp
                if (isNaN(seconds)) {
                    var tokens = objInfoTimeStamp.split('+');  // this is just the date without the GMT offset
                    var newTimestamp = tokens[0] + '+' + tokens[0].substr(0, 2) + ":" + tokens[1].substr(2, 2);
                    date = new Date(newTimestamp);
                    seconds = Math.floor((new Date() - date) / 1000);
                    if (isNaN(seconds)) {
                        // just in case that didn't work either, then parse without the timezone offset, but
                        // then just show the day and forget the fancy stuff...
                        date = new Date(tokens[0]);
                        return monthLookup[date.getMonth()] + " " + date.getDate() + ", " + date.getFullYear();
                    }
                }

                // keep it simple, just give a date
                return monthLookup[date.getMonth()] + " " + date.getDate() + ", " + date.getFullYear();
            }

            function addNodeColorKey() {
                if (needColorKey) {
                    needColorKey = false;

                    var content = $('<table/>', { cellpadding: '2', cellspacing: '0', border: '0', id: 'graphkey', style: '' });
                    var div = $('<div/>');
                    Object.keys(types).map(function (type){
                        var row = $('<tr/>', { class: 'prov-graph-color' });
                        var colorId = "row" + type
                        var colorGrid = $('<td/>', {id: colorId})
                                           
                        var colorName = $('<td/>',{text:( types[type].name)})
                                        .css('vertical-align', "top");
                        
                        row.append(colorGrid);
                        row.append(colorName);
                        $('#nodeColorKey').append(row);
                        var temp = "#" + colorId
                        var colorSvg = d3.select(temp)
                                        .append('svg')
                                        .attr('height',26)
                                        .attr('width',60);
          
                        var circle2 = colorSvg.append("line")
                            .attr("x1", 5)
                            .attr("y1", 5)
                            .attr("x2", 50)
                            .attr("y2", 5)
                            .attr("stroke-dasharray", types[type].stroke)
                            .attr("stroke-width", types[type].width)
                            .attr("stroke", types[type].color);    
        

                    })
       
                    $('body').append(content);
                    // $('#nodeColorKey').html(content);
                }
            }

            function nodeMouseover(d) {
                if(d.isFunction){return;}
                if (d.isFake) {
                    var info = d.info,
                        savedate = new Date(info[3]),
                        text = '<center><table cellpadding="2" cellspacing="0" class="table table-bordered"><tr><td>';
                    text += '<h4>Object Details</h4><table cellpadding="2" cellspacing="0" border="0" class="table table-bordered table-striped">';
                    text += '<tr><td><b>Name</b></td><td>' + info[1] + "</td></tr>";
                    text += "</td></tr></table></td><td>";
                    text += '<h4>Provenance</h4><table cellpadding="2" cellspacing="0" class="table table-bordered table-striped">';
                    text += '<tr><td><b>N/A</b></td></tr>';
                    text += '</table>';
                    text += "</td></tr></table>";
                    $container.find('#objdetailsdiv').html(text);
                } else {
                    workspace.get_object_provenance([{
                            ref: d.objId
                        }])
                        .then(function (objdata) {
                            var info = d.info,
                                found = false,
                                text = '<center><table cellpadding="2" cellspacing="0" class="table table-bordered"><tr><td>';
                            text += '<h4>Data Object Details</h4><table cellpadding="2" cellspacing="0" border="0" class="table table-bordered table-striped">';
                            text += '<tr><td><b>Name</b></td><td>' + info[1] + ' (<a href="#/dataview/' + info[6] + "/" + info[1] + "/" + info[4] + '" target="_blank">' + info[6] + "/" + info[0] + "/" + info[4] + "</a>)</td></tr>";
                            text += '<tr><td><b>Type</b></td><td><a href="#/spec/type/' + info[2] + '">' + info[2] + '</a></td></tr>';
                            text += '<tr><td><b>Saved on</b></td><td>' + getTimeStampStr(info[3]) + "</td></tr>";
                            text += '<tr><td><b>Saved by</b></td><td><a href="#/people/' + info[5] + '" target="_blank">' + info[5] + "</td></tr>";
                            var metadata = '<tr><td><b>Meta data</b></td><td><div style="width:250px;word-wrap: break-word;">';
                            for (var m in info[10]) {
                                found = true;
                                metadata += "<b>" + m + "</b> : " + info[10][m] + "<br>";
                            }
                            if (found) {
                                text += metadata + "</div></td></tr>";
                            }
                            text += "</div></td></tr></table></td><td>";
                            text += '<h4>Provenance</h4><table cellpadding="2" cellspacing="0" class="table table-bordered table-striped">';

                            if (objdata.length > 0) {
                                if (objdata[0].copied) {
                                    text += getTableRow("Copied from", '<a href="#/dataview/' + objdata[0].copied + '" target="_blank">' + objdata[0].copied + '</a>');
                                }
                                if (objdata[0]['provenance'].length > 0) {
                                    var prefix = "";
                                    for (var k = 0; k < objdata[0]['provenance'].length; k++) {
                                        if (objdata[0]['provenance'].length > 1) {
                                            prefix = "Action " + k + ": ";
                                        }
                                        text += getProvRows(objdata[0]['provenance'][k], prefix);
                                    }
                                } else {
                                    text += '<tr><td></td><td><b><span style="color:red">No provenance data set.</span></b></td></tr>';
                                }
                            } else {
                                text += '<tr><td></td><td><b><span style="color:red">No provenance data set.</span></b></td></tr>';
                            }
                            text += '</table>';
                            text += "</td></tr></table>";
                            $container.find('#objdetailsdiv').html(text);

                        })
                        .catch(function (err) {
                            var info = d.info;
                            var text = '<center><table cellpadding="2" cellspacing="0" class="table table-bordered"><tr><td>';
                            text += '<h4>Data Object Details</h4><table cellpadding="2" cellspacing="0" border="0" class="table table-bordered table-striped">';
                            text += '<tr><td><b>Name</b></td><td>' + info[1] + '(<a href="#/dataview/' + info[6] + "/" + info[1] + "/" + info[4] + '" target="_blank">' + info[6] + "/" + info[0] + "/" + info[4] + "</a>)</td></tr>";
                            text += '<tr><td><b>Type</b></td><td><a href="#/spec/type/' + info[2] + '">' + info[2] + '</a></td></tr>';
                            text += '<tr><td><b>Saved on</b></td><td>' + getTimeStampStr(info[3]) + "</td></tr>";
                            text += '<tr><td><b>Saved by</b></td><td><a href="#/people/' + info[5] + '" target="_blank">' + info[5] + "</td></tr>";
                            var found = false;
                            var metadata = '<tr><td><b>Meta data</b></td><td><div style="width:250px;word-wrap: break-word;">';
                            for (var m in info[10]) {
                                found = true;
                                metadata += "<b>" + m + "</b> : " + info[10][m] + "<br>";
                            }
                            if (found) {
                                text += metadata + "</div></td></tr>";
                            }
                            text += "</div></td></tr></table></td><td>";
                            text += '<h4>Provenance</h4><table cellpadding="2" cellspacing="0" class="table table-bordered table-striped">';
                            text += "error in fetching provenance";
                            text += '</table>';
                            text += "</td></tr></table>";
                            console.error('Error fetching provenance');
                            console.error(err);
                            $container.find('#objdetailsdiv').html(text);
                        });
                }
            }
            function getProvRows(provenanceAction, prefix) {
                /* structure {
                 timestamp time;
                 string service;
                 string service_ver;
                 string method;
                 list<UnspecifiedObject> method_params;
                 string script;
                 string script_ver;
                 string script_command_line;
                 list<obj_ref> input_ws_objects;
                 list<obj_ref> resolved_ws_objects;
                 list<string> intermediate_incoming;
                 list<string> intermediate_outgoing;
                 string description;
                 } ProvenanceAction;*/
                var rows = [];
                if ('description' in provenanceAction) {
                    rows.push(getTableRow(prefix + "Description", provenanceAction['description']));
                }
                if ('service' in provenanceAction) {
                    rows.push(getTableRow(prefix + "Service Name", provenanceAction['service']));
                }
                if ('service_ver' in provenanceAction) {
                    rows.push(getTableRow(prefix + "Service Version", provenanceAction['service_ver']));
                }
                if ('method' in provenanceAction) {
                    rows.push(getTableRow(prefix + "Method", provenanceAction['method']));
                }
                if ('method_params' in provenanceAction) {
                    rows.push(getTableRow(prefix + "Method Parameters", JSON.stringify(scrub(provenanceAction['method_params']), null, '  ')));
                }

                if ('script' in provenanceAction) {
                    rows.push(getTableRow(prefix + "Command Name", provenanceAction['script']));
                }
                if ('script_ver' in provenanceAction) {
                    rows.push(getTableRow(prefix + "Script Version", provenanceAction['script_ver']));
                }
                if ('script_command_line' in provenanceAction) {
                    rows.push(getTableRow(prefix + "Command Line Input", provenanceAction['script_command_line']));
                }

                if ('intermediate_incoming' in provenanceAction) {
                    if (provenanceAction['intermediate_incoming'].length > 0)
                        rows.push(getTableRow(prefix + "Action Input", JSON.stringify(provenanceAction['intermediate_incoming'], null, '  ')));
                }
                if ('intermediate_outgoing' in provenanceAction) {
                    if (provenanceAction['intermediate_outgoing'].length > 0)
                        rows.push(getTableRow(prefix + "Action Output", JSON.stringify(provenanceAction['intermediate_outgoing'], null, '  ')));
                }

                if ('external_data' in provenanceAction) {
                    if (provenanceAction['external_data'].length > 0) {
                        rows.push(getTableRow(prefix + "External Data",
                            formatProvenanceExternalData(
                                provenanceAction['external_data']),
                            null, '  '));
                    }
                }

                if ('time' in provenanceAction) {
                    rows.push(getTableRow(prefix + "Timestamp", getTimeStampStr(provenanceAction['time'])));
                }

                return rows.join('');
            }
            function formatProvenanceExternalData(extData) {
                /*
                 * string resource_name - the name of the resource, for example JGI.
                 * string resource_url - the url of the resource, for example
                 *      http://genome.jgi.doe.gov
                 * string resource_version - version of the resource
                 * timestamp resource_release_date - the release date of the resource
                 * string data_url - the url of the data, for example
                 *      http://genome.jgi.doe.gov/pages/dynamicOrganismDownload.jsf?
                 *      organism=BlaspURHD0036
                 * string data_id - the id of the data, for example
                 *    7625.2.79179.AGTTCC.adnq.fastq.gz
                 * string description - a free text description of the data.
                 */
                var rethtml = '';
                extData.forEach(function (edu) {
                    if ('resource_name' in edu) {
                        rethtml += '<b>Resource Name</b><br/>';
                        if ('resource_url' in edu) {
                            rethtml += '<a target="_blank" href=' + edu['resource_url'];
                            rethtml += '>';
                        }
                        rethtml += edu["resource_name"];
                        if ('resource_url' in edu) {
                            rethtml += '</a>';
                        }
                        rethtml += '<br/>';
                    }
                    if ('resource_version' in edu) {
                        rethtml += "<b>Resource Version</b><br/>";
                        rethtml += edu["resource_version"] + "<br/>";
                    }
                    if ('resource_release_date' in edu) {
                        rethtml += "<b>Resource Release Date</b><br/>";
                        rethtml += getTimeStampStr(edu["resource_release_date"]) + "<br/>";
                    }
                    if ('data_id' in edu) {
                        rethtml += '<b>Data ID</b><br/>';
                        if ('data_url' in edu) {
                            rethtml += '<a target="_blank" href=' + edu['data_url'];
                            rethtml += '>';
                        }
                        rethtml += edu["data_id"];
                        if ('data_url' in edu) {
                            rethtml += '</a>';
                        }
                        rethtml += '<br/>';
                    }
                    if ('description' in edu) {
                        rethtml += "<b>Description</b><br/>";
                        rethtml += edu["description"] + "<br/>";
                    }
                });
                return rethtml;
            }
            // removes any keys named 'auth'
            function scrub(objectList) {
                if (objectList && (objectList.constructor === Array)) {
                    for (var k = 0; k < objectList.length; k++) {
                        if (objectList[k] && typeof objectList[k] === 'object') {
                            if (objectList[k].hasOwnProperty('auth')) {
                                delete objectList[k].auth;
                            }
                        }
                    }
                }
                return objectList;
            }
            function getTableRow(rowTitle, rowContent) {
                return tr([
                    td({style: {maxWidth: '250px'}}, [
                        b(rowTitle)
                    ]),
                    td({style: {maxWidth: '300px'}}, [
                        div({style: {maxWidth: '300px', maxHeight: '250px', overflowY: 'auto', whiteSpace: 'pre', wordWrap: 'break-word'}}, [
                            rowContent
                        ])
                    ])
                ]);
            }
            function getNodeLabel(info) {
                return info[1] + " (v" + info[4] + ")";
            }

            function processObjectHistory(data) {
                //central object (current object and all its versions)
                var node, node2, objIdentities = [],
                    latestVersion = 0,
                    latestObjId = "";


                data.forEach(function (objectInfo) {
                    //0:obj_id, 1:obj_name, 2:type ,3:timestamp, 4:version, 5:username saved_by, 6:ws_id, 7:ws_name, 8 chsum, 9 size, 10:usermeta
                    var t = objectInfo[2].split("-")[0],
                        objId = objectInfo[6] + "/" + objectInfo[0] + "/" + objectInfo[4],
                        //first object must be 0; TODO: change this to depend on usage or provenance
                        nodeId = 0;

                    if (objectInfo[4] > latestVersion) {
                        node = {
                            name: getNodeLabel(objectInfo),
                            info: objectInfo,
                            targetNodesSvgId : [],
                            objId: objId,
                            isPresent: true
                        }
                        node2 = {
                            name: getNodeLabel(objectInfo),
                            info: objectInfo,
                            targetNodesSvgId : [],
                            objId: objId,
                            isPresent: true
                        }
                        latestVersion = objectInfo[4];
                        latestObjId = objId;
                    }
                    objIdtoDataRef[objId] = nodeId;
                    objIdtoDataProv[objId] = nodeId;
                    nodePaths [objId] = objId;
                    objIdentities.push({ref: objId});
                });

                provenanceGraph.nodes.push(node);
                referenceGraph.nodes.push(node2);
                return {ref: latestObjId};
            }

            function showError(err) {
                $container.find('#loading-mssg').hide();
                $container.append("<br><b>Error in building object graph!</b><br>");
                $container.append("<i>Error was:</i></b> &nbsp ");
                var message;
                if (err.message) {
                    message = err.message;
                } else if (err.error && err.error.message) {
                    message = err.error.message;
                } else {
                    message = 'unknown error (check console)';
                }
                $container.append(message + "<br>");
                console.error("Error in building object graph!");
                console.error(err);
            }
            function addNodeLink(refData,objectIdentity, isRef, functionNode) {
                //
                for (var i = 0; i < Math.min(refData.length, 10); i++) {
                    var limit = 10;
    
                        var refInfo =refData[i];
                        var t = refInfo[2].split("-")[0];
                        var objId = refInfo[6] + "/" + refInfo[0] + "/" + refInfo[4];
                        //0:obj_id, 1:obj_name, 2:type ,3:timestamp, 4:version, 5:username saved_by, 6:ws_id, 7:ws_name, 8 chsum, 9 size, 10:usermeta

                        //pushes reference nodes into list
                        var node = {
                            name: getNodeLabel(refInfo),
                            info: refInfo,
                            objId: objId,
                            targetNodesSvgId : []
                        };
                        var targetId = isRef ? objIdtoDataRef[objectIdentity.ref] : objIdtoDataProv[objectIdentity.ref];


                        if(functionNode){
                          if(!isRef){
                            var functionId = provenanceGraph.nodes.length;
                            provenanceGraph.nodes.push(functionNode);
                            provenanceGraph.links.push(makeLink(targetId, functionId));
                            targetId = functionId;
                          }
                        }

                        var nodeId;

                        var nodeId= isRef ? referenceGraph.nodes.length : provenanceGraph.nodes.length;
                        if(isRef){
                          if(objIdtoDataRef[objId]){
                            nodeId = objIdtoDataRef[objId];
                          }else{
                            objIdtoDataRef[objId] = nodeId;
                          }
                        }else{
                          if(objIdtoDataProv[objId]){
                            nodeId = objIdtoDataProv[objId];
                          }else{
                            objIdtoDataProv[objId] = nodeId;
                          }
                        }

                        if (targetId !== null) {  // only add the link if it is visible
                            var link = makeLink(targetId, nodeId, 1);
                            node.targetNodesSvgId.push("#path" + nodeId + "_" + targetId);

                            if(isRef){
                              referenceGraph.nodes.push(node);
                              referenceGraph.links.push(link);
                            }else{
                              provenanceGraph.nodes.push(node);
                              provenanceGraph.links.push(link);
                            }
                        }
                }
            }
            function getReferencingObjects(objectIdentity) {
                //workspace requires list for referencing objects

                return workspace.list_referencing_objects([objectIdentity])
                    .then(function(refData){
                      const isRef = true;
                      //since only one item in list, will flatten array one level
                      addNodeLink(refData[0],objectIdentity, isRef);
                    });
            }

            function makeLink(source, target, value) {
                return {
                    source: source,
                    target: target,
                    value: value
                };
            }

            function getObjectProvenance(objectIdentity){
              // debugger;
              let path = nodePaths[objectIdentity.ref];
              var objectPath = (path)? ({ref:path}) : objectIdentity;
              //TODO: global unique provenance items
              //had to wrap identity in array as it somehow wanted a list
              var functionNode;
              return workspace.get_objects2({
                  objects:[objectPath],
                  no_data: 1
                })
                  .then(function (provData) {
                    // debugger;
                    var uniqueRefs = {},
                        uniqueProvPaths = [],
                        uniqueRefPaths = [],
                        uniqueCombinePaths = [];
                     for (var i = 0; i < provData.data.length; i++) {
                            let objectProvenance = provData.data[i];
                            objectProvenance.provenance.forEach(function (provenance) {
                                var objRef = getObjectRef(objectProvenance.info);

                                functionNode = {
                                    isFunction: true,
                                    objId: "to" + objectIdentity.ref,
                                    name: provenance.service,
                                    method: provenance.method
                                }
                                if (provenance.resolved_ws_objects) {
                                    provenance.resolved_ws_objects.forEach(function (resolvedObjectRef) {

                                         if (!(resolvedObjectRef in uniqueRefs)) {
                                            uniqueRefs[resolvedObjectRef] = 'included';
                                            //resolvedObjectref is the prov id
                                            //TODO: check if in set of workspace!!

                                            var path = nodePaths[objectIdentity.ref] + ";" + resolvedObjectRef;
                                            nodePaths[resolvedObjectRef] = path;
                                            uniqueProvPaths.push({ref: path});
                                        }
                                    });
                                }
                            });
                      }
                    //   debugger;
                    var dependencies = provData.data[0].refs;
                    for (var i = 0; i <dependencies.length; i++){
                        var path = nodePaths[objectIdentity.ref] + ";" + dependencies[i];
                        nodePaths[dependencies[i]] = path;
                        if(uniqueRefs[dependencies[i]]){
                            uniqueCombinePaths.push(path);
                        }else{
                            uniqueRefPaths.push(path);
                        }
                    }
                      return [uniqueProvPaths, uniqueRefPaths, uniqueCombinePaths];
                  }).spread(function(uniqueProvPaths, uniqueRefPaths, uniqueCombinePaths){
                          if(uniqueProvPaths.length === 0){
                            return [null, objectIdentity, functionNode];
                          }else{
                            //get_object_info_new deprecated. new method only availble on generic client
                            // return Promise.all([workspace.get_object_info_new({
                            //   objects: uniqueProvPaths,
                            //   includeMetadata: 1,
                            //   ignoreErrors: 1
                            // }),objectIdentity, functionNode]);
                            return Promise.all([client.callFunc('get_object_info3',[{
                              objects: uniqueProvPaths,
                              includeMetadata: 1
                            }])
                            ,objectIdentity, functionNode]);
                          }

                   }).spread(function (refData, objectIdentity, functionNode) {
                    //generic client wrapped result in an array.    
                    if(refData !== null){
                        refData = refData[0].infos;
                      const isRef = false;
                      //TODO set type of link
                      addNodeLink(refData,objectIdentity, isRef, functionNode);

                    }
                   }).catch(function(err){console.log(err)});
            }

            function isUndefNull(obj) {
                if (obj === null || obj === undefined) {
                    return true;
                }
                return false;
            }


            function buildDataAndRender(objref) {
                $container.find('#loading-mssg').show();
                $container.find('#objgraphview').hide();
                //gets verions of object
                workspace.get_object_history(objref)
                    .then(function (data) {
                        return processObjectHistory(data);
                    })
                    .then(function (objectIdentity) {

                      // TODO: ADD CHECK TO MAKE SURE THIS IS LATEST VERSION
                        // const objectIdentity = objIdentities[objIdentities.length -1];
                        // we have the history of the object of interest,
                        // now we can fetch all referencing object, and
                        // get prov info for each of these objects
                        return Promise.all([
                            getReferencingObjects(objectIdentity),
                            getObjectProvenance(objectIdentity)
                        ]);

                    })

                    .then(function () {

                        finishUpAndRender();
                    })
                    .catch(function (err) {
                        showError(err);
                    });

            }
            function layer(nodesData){
                const len = nodesData.length;
                for(let i = 0; i <len; i++){
                    //call provenance;
                }

                
            }            

            function renderForceTree(nodesData, linksData, isRef){
                //TODO: copy loop through nodes and get provenances, with nodes hidden
              var width = 600,
                  height = 400,
                  radius = 10,
                  oldNodes, // data
                  svg, node, link, // d3 selections
                  force = d3.layout.force()
                    .charge(-300)
                    .size([width, height]);

              var nodes = nodesData;
              var links = linksData;
              var t = d3.transition()
                  .duration(1750);

              if(isRef){
                  svg = d3.select($container.find("#ref-tab")[0])
                      .append("svg")
                      .attr("width", width)
                      .attr("height", height);
                svg.attr('class', 'ref');
              }else{
                  svg = d3.select($container.find("#prov-tab")[0])
                      .append("svg")
                      .attr("width", width)
                      .attr("height", height);       
                  svg.attr('class', 'prov');
       
             }

              function update(newNodes, newLinks) {
         
                force.nodes(nodes).links(links);

                var l = svg.selectAll(".link")
                  .data(links, function(d) {return d.source + "," + d.target});
                var n = svg.selectAll(".node")
                  .data(nodes, function(d) {return d.name});
                enterLinks(l);
                enterNodes(n);
                link = svg.selectAll(".link");
                node = svg.selectAll(".node");
                force.start();

                for (var i = 100; i > 0; --i) force.tick();
                force.stop();
              }

              function enterNodes(n) {
                oldNodes = [];
     
                var g = n.enter()
                  .append("g")
                  .attr("class", "node")
                  .each(function (d) {oldNodes.push(d);})
                  .on('dblclick',click)
                  .on('click', nodeMouseover)
                  .call(force.drag);

                g.append("circle")
                  .attr("cx", 0)
                  .attr("cy", 0)
                  .attr("r", function (d) {return d.isFunction ? radius : radius})
                  .transition(t)
                  .style('fill',  function (d) {
                    if (d.isFunction) return "black";
                    return isRef ? '#2196F3' : '#4BB856';
                  });
                g.transition

                // g.append("rect")
                //     .attr("x", 10)
                //     .attr("y", 10)
                //     .attr("width", function(d){ return (d.name.length * 5);})
                //     .attr("height", 10)
                //     .style('fill',  function (d) {
                //     if (d.isFunction) return "black";
                //     return isRef ? '#2196F3' : '#4BB856';
                //   });

                g.append("text")
                //   .attr("dy", ".35em")
                  .text(function(d) {return d.name});
              }

              function enterLinks(l) {
                l.enter()
                  .insert("line", ".node")
                  .attr("class", "link")
                  .attr('id', function(d){return "#path" + d.source + "_" + d.target})
                  .attr('marker-end', 'url(#markerArrow)')
                  .transition(t)
                  .style("stroke-dasharray", function(d) {return ("3, 3")})
                  .style("stroke-width", function(d) { return 5 })

                var defs = svg.append('svg:defs')

                var dummyData = [1];

                var marker = defs.selectAll('marker')
                    .data(dummyData)
                    .enter()
                    .append('svg:marker')
                    .attr('id', 'markerArrow')
                    .attr('markerHeight', 3)
                    .attr('markerWidth', 3)
                    .attr('orient', 'auto')
                    .attr('refX', 5)
                    .attr('refY', 0)
                    .attr('viewBox', '-5 -5 10 10')
                    .append('svg:path')
                    .attr('d', 'M 0,0 m -5,-5 L 5,0 L -5,5 Z')
                    .attr('fill', "blue");
              }

              function maintainNodePositions() {
                oldNodes.forEach( function(d) {
                  d.fixed = true;
                });
              }
              var drag = force.drag()
                  .on("dragstart", dragstart)
                //   .on('drag', drag)
                  .on("dragend", dragstop);
              function dragstart(d) {
                  d.fixed = true;

                  force.stop();
              }
              function dragstop(d){
                d.fixed = true;
                force.stop();
              }
            //   function drag(d){
            //     //   console.log(d);
            //       force.stop();

            //   }

              force.on("tick", tick);
              function tick(e) {
                  var q = d3.geom.quadtree(nodes),
                      i = 0,
                      n = nodes.length;

                  while (++i < n) q.visit(collide(nodes[i]));
                var k = 10 * e.alpha;
                // k *= isRef ? -1 : 1;
                // Push sources up and targets down to form a weak tree.
                  node.attr("cx", function(d) { return d.x = Math.max(radius, Math.min(width - radius, d.x)); })
                      .attr("cy", function(d) { return d.y = Math.max(radius, Math.min(height - radius, d.y)); })
                    .attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")"; });
                  // Push sources up and targets down to form a weak tree.
                  link
                      .each(function(d) {
                        // if(isRef){
                        //   d.source.y -= k, d.target.y += k;
                        // }else{
                          d.source.y += k, d.target.y -= k;
                        // }
                        })
                      .attr("x1", function(d) { return d.source.x; })
                      .attr("y1", function(d) { return d.source.y; })
                      .attr("x2", function(d) { return d.target.x; })
                      .attr("y2", function(d) { return d.target.y; });
              };


              force.on('end', function(e){
                  oldNodes = nodes;
                // updatePos();
                  maintainNodePositions();

              });

              function updatePos(){
                  height += 100;
                  svg.attr('height', height);
                  svg.selectAll(".node")
                      .attr("cy", function (d) { d.y += 100; return d.y = Math.max(radius, Math.min(height - radius, d.y)); })
                      .attr("transform", function (d) { return "translate(" + d.x + "," + d.y + ")"; })
                      .transition();

                  svg.selectAll(".link")
                      .attr("x1", function (d) { return d.source.x; })
                      .attr("y1", function (d) { return d.source.y; })
                      .attr("x2", function (d) { return d.target.x; })
                      .attr("y2", function (d) { return d.target.y; })
                      .transition();
              }

              function click(node){
                var nodeId = {ref: node.objId};
                if(node.isPresent){
                  debugger;
                }else{
                  if(isRef){
                    getReferencingObjects(nodeId)
                    .then(function(){
                      update();
                      node.isPresent = true;
                      var buffer = 100;

                    })
                  }else{
                    getObjectProvenance(nodeId)
                    .then(function(){
                    //   height +=100
                    //   svg.attr("height", height);
                    
                    update();
                    // updatePos();
                      node.isPresent = true;
                    });
                  }
                }
              }

              function collide(node) {
                  var r = node.radius + 16,
                      nx1 = node.x - r,
                      nx2 = node.x + r,
                      ny1 = node.y - r,
                      ny2 = node.y + r;
                  return function (quad, x1, y1, x2, y2) {
                      if (quad.point && (quad.point !== node)) {
                          var x = node.x - quad.point.x,
                              y = node.y - quad.point.y,
                              l = Math.sqrt(x * x + y * y),
                              r = node.radius + quad.point.radius;
                          if (l < r) {
                              l = (l - r) / l * .5;
                              node.x -= x *= l;
                              node.y -= y *= l;
                              quad.point.x += x;
                              quad.point.y += y;
                          }
                      }
                      return x1 > nx2 || x2 < nx1 || y1 > ny2 || y2 < ny1;
                  };
                }
              
              update();
            }
            function finishUpAndRender() {

                d3.select($container.find("#objgraphview")).html("");
                $container.find('#objgraphview').show();
                var ul = $('<ul class="nav nav-tabs"  role="tablist"/>');
                ul.append('<li role="presentation" class="active"><a href="#prov-tab" aria-controls="prov-tab" role="tab" data-toggle="tab">Provenance and Dependencies</a></li>')
                ul.append('<li role="presentation"  ><a href="#ref-tab" aria-controls="usage-tab" role="tab" data-toggle="tab">Object Usage</a></li>')
                var content = $('<div/>',{class:'tab-content'});
                content.append('<div role="tabpanel" class="tab-pane active" id="prov-tab"></div>');
                content.append('<div role="tabpanel" class="tab-pane " id="ref-tab"></div>');
                $('#objgraphview').append(ul);
                $('#objgraphview').append(content);
                renderForceTree(provenanceGraph.nodes, provenanceGraph.links, false);
                renderForceTree(referenceGraph.nodes, referenceGraph.links, true);
                addNodeColorKey();
                $container.find('#loading-mssg').hide();
            }

            function getData() {
                return {title: "Data Object Reference Network", workspace: workspaceId, id: "This view shows the data reference connections to object " + objectId};
            }

            // Widget API
            function attach(node) {
                mount = node;
                container = dom.createElement('div');
                $container = $(container);
                container.innerHTML = renderLayout();
                mount.appendChild(container);
            }
            function start(params) {
                needColorKey = true; // so that the key renders
                workspaceId = params.workspaceId;
                objectId = params.objectId;
                buildDataAndRender(getObjectIdentity(params.workspaceId, params.objectId));
            }
            function stop() {

            }
            function detach() {
                mount.removeChild(container);
            }

            return {
                attach: attach,
                start: start,
                stop: stop,
                detach: detach
            };
        }

        return {
            make: function (config) {
                return widget(config);
            }
        };
    });
