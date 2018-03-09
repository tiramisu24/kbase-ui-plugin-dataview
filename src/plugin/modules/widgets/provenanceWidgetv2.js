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
    'dagre',

    'bootstrap',
    'd3_sankey'
],
function (Promise, $, d3, html, dom, Workspace, GenericClient, dagre) {
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
                startingNode: {
                    color: '#ffeaad',
                    borderColor: '#dbbc60',
                    name: 'Current object',
                    width: objWidth,
                    stroke: (10,0)                    },
                functionNode: {
                    color: '#bbb6c1',
                    borderColor: 'grey',
                    name: 'Functions',
                    width: objWidth,
                    stroke: (10,0)
                },
                noRefs: {
                    color: '#b5d6ff',
                    name: 'All References and Dependencies Displayed',
                    width: objWidth,
                    stroke: (10,0)
                },
                node: {
                    color: '#87abff',
                    borderColor: '#6079b2',
                    name: 'Objects',
                    width: objWidth,
                    stroke: (10,0)
                },
                dependencies: {
                    color: 'grey',
                    name: 'Dependencies Refereneces',
                    width: lineWidth,
                    stroke: (5, 5)
                },
                refs: {
                    color: 'grey',
                    name: 'Provenance References',
                    width: lineWidth,
                    stroke: (10, 0)
                }
            },
            monthLookup = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
            existingNodeGraphId = {
            },
            combineGraph = {
                nodes: [],
                links: []
            },
            nodePaths = {

            },
            existingLinks = {

            },
            existingFunctions ={

            },
            exemptObjects ={
                // 'KBaseReport.Report':true,
                'DataPalette.DataPalette': true
            },
            div = html.tag('div'),
            br = html.tag('br'),
            tr = html.tag('tr'),
            td = html.tag('td'),
            b = html.tag('b'),
            //d3 rendering
            svgWidth = 1200,
            svgHeight = 700,
            rectWidth = 110,
            rectHeight = 40,
            dgraph = new dagre.graphlib.Graph();

        function renderLayout() {
            return div([
                div(['This is a visualization of the relationships between this piece of data and other data in KBase.  Click objects to show additional information (shown below the graph). Double click on an object expand graph.', br(), br()]),
                div({id: 'objgraphview2', style: {overflow: 'auto', height: "" + (svgHeight * 3/4) + "px", resize: 'vertical'}}),
                div({id: 'nodeColorKey2'})
            ]);
        }

        /* Construct an ObjectIdentity that can be used to query the WS*/
        function getObjectIdentity(wsNameOrId, objNameOrId, objVer) {
            if (objVer) {
                return {ref: wsNameOrId + '/' + objNameOrId + '/' + objVer};
            }
            return {ref: wsNameOrId + '/' + objNameOrId};
        }
        // function getObjectRef(objectInfo) {
        //     return [objectInfo[6], objectInfo[0], objectInfo[4]].join('/');
        // }
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
                var newTimestamp = tokens[0] + '+' + tokens[0].substr(0, 2) + ':' + tokens[1].substr(2, 2);
                date = new Date(newTimestamp);
                seconds = Math.floor((new Date() - date) / 1000);
                if (isNaN(seconds)) {
                    // just in case that didn't work either, then parse without the timezone offset, but
                    // then just show the day and forget the fancy stuff...
                    date = new Date(tokens[0]);
                    return monthLookup[date.getMonth()] + ' ' + date.getDate() + ', ' + date.getFullYear();
                }
            }

            // keep it simple, just give a date
            return monthLookup[date.getMonth()] + ' ' + date.getDate() + ', ' + date.getFullYear();
        }

        function addNodeColorKey() {
            if (needColorKey) {
                needColorKey = false;

                var content = $('<div/>', {  id: 'graphkey2' });
                var nodeColorKey2 = $('#nodeColorKey2');
                nodeColorKey2.append(content);

                Object.keys(types).map(function (type){
                    var row = $('<tr/>', { class: 'prov-graph-color' });
                    var colorId = 'row' + type;
                    var colorGrid = $('<td/>', {id: colorId});
                                           
                    var colorName = $('<td/>',{text:( types[type].name)})
                        .css('vertical-align', 'top');
                        
                    row.append(colorGrid);
                    row.append(colorName);
                    $('#graphkey2').append(row);
                    var temp = '#' + colorId;
                    var colorSvg = d3.select(temp)
                        .append('svg')
                        .attr('height',26)
                        .attr('width',60);
          
                    colorSvg.append('line')
                        .attr('x1', 5)
                        .attr('y1', 5)
                        .attr('x2', 50)
                        .attr('y2', 5)
                        .attr('stroke-dasharray', types[type].stroke)
                        .attr('stroke-width', types[type].width)
                        .attr('stroke', types[type].color);    
                });

                nodeColorKey2.append($('<div/>', {id : 'objdetailsdiv'}));
            }
        }

        function onNodeClick(d) {
            if(d.isFunction){return;}
            if (d.isFake) {
                var info = d.info,
                    text = '<center><table cellpadding="2" cellspacing="0" class="table table-bordered"><tr><td>';
                text += '<h4>Object Details</h4><table cellpadding="2" cellspacing="0" border="0" class="table table-bordered table-striped">';
                text += '<tr><td><b>Name</b></td><td>' + info[1] + '</td></tr>';
                text += '</td></tr></table></td><td>';
                text += '<h4>Provenance</h4><table cellpadding="2" cellspacing="0" class="table table-bordered table-striped">';
                text += '<tr><td><b>N/A</b></td></tr>';
                text += '</table>';
                text += '</td></tr></table>';
                $container.find('#objdetailsdiv').html(text);
            } else {
                try {
                    var objdata = d.data;
                    var info = objdata.info,
                        found = false,
                        text = '<center><table cellpadding="2" cellspacing="0" class="table table-bordered"><tr><td>';
                    text += '<h4>Data Object Details</h4><table cellpadding="2" cellspacing="0" border="0" class="table table-bordered table-striped">';
                    text += '<tr><td><b>Name</b></td><td>' + info[1] + ' (<a href="#/dataview/' + info[6] + '/' + info[1] + '/' + info[4] + '" target="_blank">' + info[6] + '/' + info[0] + '/' + info[4] + '</a>)</td></tr>';
                    text += '<tr><td><b>Type</b></td><td><a href="#/spec/type/' + info[2] + '">' + info[2] + '</a></td></tr>';
                    text += '<tr><td><b>Saved on</b></td><td>' + getTimeStampStr(info[3]) + '</td></tr>';
                    text += '<tr><td><b>Saved by</b></td><td><a href="#/people/' + info[5] + '" target="_blank">' + info[5] + '</td></tr>';
                    var metadata = '<tr><td><b>Meta data</b></td><td><div style="width:250px;word-wrap: break-word;">';
                    for (var m in info[10]) {
                        found = true;
                        metadata += '<b>' + m + '</b> : ' + info[10][m] + '<br>';
                    }
                    if (found) {
                        text += metadata + '</div></td></tr>';
                    }
                    text += '</div></td></tr></table></td><td>';
                    text += '<h4>Provenance</h4><table cellpadding="2" cellspacing="0" class="table table-bordered table-striped">';

                    if (objdata.copied) {
                        text += getTableRow('Copied from', '<a href="#/dataview/' + objdata.copied + '" target="_blank">' + objdata.copied + '</a>');
                    }
                    if (objdata.provenance.length > 0) {
                        var prefix = '';
                        for (var k = 0; k < objdata.provenance.length; k++) {
                            if (objdata.provenance.length > 1) {
                                prefix = 'Action ' + k + ': ';
                            }
                            text += getProvRows(objdata.provenance[k], prefix);
                        }
                    } else {
                        text += '<tr><td></td><td><b><span style="color:red">No provenance data set.</span></b></td></tr>';
                    }
                    text += '</table>';
                    text += '</td></tr></table>';
                    $container.find('#objdetailsdiv').html(text);

                }
                catch(err) {
                    var info = d.info;
                    var text = '<center><table cellpadding="2" cellspacing="0" class="table table-bordered"><tr><td>';
                    text += '<h4>Data Object Details</h4><table cellpadding="2" cellspacing="0" border="0" class="table table-bordered table-striped">';
                    text += '<tr><td><b>Name</b></td><td>' + info[1] + '(<a href="#/dataview/' + info[6] + '/' + info[1] + '/' + info[4] + '" target="_blank">' + info[6] + '/' + info[0] + '/' + info[4] + '</a>)</td></tr>';
                    text += '<tr><td><b>Type</b></td><td><a href="#/spec/type/' + info[2] + '">' + info[2] + '</a></td></tr>';
                    text += '<tr><td><b>Saved on</b></td><td>' + getTimeStampStr(info[3]) + '</td></tr>';
                    text += '<tr><td><b>Saved by</b></td><td><a href="#/people/' + info[5] + '" target="_blank">' + info[5] + '</td></tr>';
                    var found = false;
                    var metadata = '<tr><td><b>Meta data</b></td><td><div style="width:250px;word-wrap: break-word;">';
                    for (var m in info[10]) {
                        found = true;
                        metadata += '<b>' + m + '</b> : ' + info[10][m] + '<br>';
                    }
                    if (found) {
                        text += metadata + '</div></td></tr>';
                    }
                    text += '</div></td></tr></table></td><td>';
                    text += '<h4>Provenance</h4><table cellpadding="2" cellspacing="0" class="table table-bordered table-striped">';
                    text += 'error in fetching provenance';
                    text += '</table>';
                    text += '</td></tr></table>';
                    console.error('Error fetching provenance');
                    console.error(err);
                    $container.find('#objdetailsdiv').html(text);
                }
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
                rows.push(getTableRow(prefix + 'Description', provenanceAction['description']));
            }
            if ('service' in provenanceAction) {
                rows.push(getTableRow(prefix + 'Service Name', provenanceAction['service']));
            }
            if ('service_ver' in provenanceAction) {
                rows.push(getTableRow(prefix + 'Service Version', provenanceAction['service_ver']));
            }
            if ('method' in provenanceAction) {
                rows.push(getTableRow(prefix + 'Method', provenanceAction['method']));
            }
            if ('method_params' in provenanceAction) {
                rows.push(getTableRow(prefix + 'Method Parameters', JSON.stringify(scrub(provenanceAction['method_params']), null, '  ')));
            }

            if ('script' in provenanceAction) {
                rows.push(getTableRow(prefix + 'Command Name', provenanceAction['script']));
            }
            if ('script_ver' in provenanceAction) {
                rows.push(getTableRow(prefix + 'Script Version', provenanceAction['script_ver']));
            }
            if ('script_command_line' in provenanceAction) {
                rows.push(getTableRow(prefix + 'Command Line Input', provenanceAction['script_command_line']));
            }

            if ('intermediate_incoming' in provenanceAction) {
                if (provenanceAction['intermediate_incoming'].length > 0)
                    rows.push(getTableRow(prefix + 'Action Input', JSON.stringify(provenanceAction['intermediate_incoming'], null, '  ')));
            }
            if ('intermediate_outgoing' in provenanceAction) {
                if (provenanceAction['intermediate_outgoing'].length > 0)
                    rows.push(getTableRow(prefix + 'Action Output', JSON.stringify(provenanceAction['intermediate_outgoing'], null, '  ')));
            }

            if ('external_data' in provenanceAction) {
                if (provenanceAction['external_data'].length > 0) {
                    rows.push(getTableRow(prefix + 'External Data',
                        formatProvenanceExternalData(
                            provenanceAction['external_data']),
                        null, '  '));
                }
            }

            if ('time' in provenanceAction) {
                rows.push(getTableRow(prefix + 'Timestamp', getTimeStampStr(provenanceAction['time'])));
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
                    rethtml += edu['resource_name'];
                    if ('resource_url' in edu) {
                        rethtml += '</a>';
                    }
                    rethtml += '<br/>';
                }
                if ('resource_version' in edu) {
                    rethtml += '<b>Resource Version</b><br/>';
                    rethtml += edu['resource_version'] + '<br/>';
                }
                if ('resource_release_date' in edu) {
                    rethtml += '<b>Resource Release Date</b><br/>';
                    rethtml += getTimeStampStr(edu['resource_release_date']) + '<br/>';
                }
                if ('data_id' in edu) {
                    rethtml += '<b>Data ID</b><br/>';
                    if ('data_url' in edu) {
                        rethtml += '<a target="_blank" href=' + edu['data_url'];
                        rethtml += '>';
                    }
                    rethtml += edu['data_id'];
                    if ('data_url' in edu) {
                        rethtml += '</a>';
                    }
                    rethtml += '<br/>';
                }
                if ('description' in edu) {
                    rethtml += '<b>Description</b><br/>';
                    rethtml += edu['description'] + '<br/>';
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
            return info[1] + ' (v' + info[4] + ')';
        }

        function processObjectHistory(data) {
            var node, objIdentities = [],
                latestVersion = 0,
                latestObjId = '';

            data.forEach(function (objectData) {
                //0:obj_id, 1:obj_name, 2:type ,3:timestamp, 4:version, 5:username saved_by, 6:ws_id, 7:ws_name, 8 chsum, 9 size, 10:usermeta
                var objectInfo = objectData.info;
                var t = objectInfo[2].split('-')[0],
                    objIdGen = objectInfo[6] + '/' + objectInfo[0],
                    objId = objectInfo[6] + '/' + objectInfo[0] + '/' + objectInfo[4],
                    versionSet = {},
                    //first object must be 0; TODO: change this to depend on usage or provenance
                    nodeId = 0;
                versionSet[objectInfo[4]] = true;

                if (objectInfo[4] > latestVersion) {
                    node = {
                        name: getNodeLabel(objectInfo),
                        objId: objId,
                        type: t,
                        data: objectData,
                        isPresent: true,
                        startingObject : true,
                        referencesFrom : [],
                        versions: versionSet,
                        referencesTo : []
                    };
                    latestVersion = objectInfo[4];
                    latestObjId = objId;
                }
                existingNodeGraphId[objIdGen] = nodeId;
                nodePaths [objId] = objId;
                objIdentities.push({ref: objId});
            });

            combineGraph.nodes.push(node);
            return {ref: latestObjId};
        }

        function showError(err) {
            $container.find('#loading-mssg').hide();
            $container.append('<br><b>Error in building object graph!</b><br>');
            $container.append('<i>Error was:</i></b> &nbsp ');
            var message;
            if (err.message) {
                message = err.message;
            } else if (err.error && err.error.message) {
                message = err.error.message;
            } else {
                message = 'unknown error (check console)';
            }
            $container.append(message + '<br>');
            console.error('Error in building object graph!');
            console.error(err);
        }
        function addFunctionLink(objIdentity, functionNode, isDep){
            
            var functionId = existingFunctions[functionNode.objId];
            if(functionId !== undefined){
                return functionId;
            }else{
                functionId = combineGraph.nodes.length;
                existingFunctions[functionNode.objId] = functionId;
            }
            var objIdGen = objIdentity.ref.split('/').slice(0,2).join('/');
            var targetId = existingNodeGraphId[objIdGen];
            combineGraph.nodes.push(functionNode);
            makeLink(targetId, functionId, isDep);
            return functionId;
        }
        function getObjectIds(refData){
            var objIds = [];
            for (var i = 0; i < Math.min(refData.length, 10);i++){
                var objId = refData[i][6] + '/' + refData[i][0] + '/' + refData[i][4];
                objIds.push({ref: objId});
            }
            return objIds;
        }
        function addNodeLink(data, targetId, isDep) {
            for (var i = 0; i < Math.min(data.length, 10); i++) {
                    
                //0:obj_id, 1:obj_name, 2:type ,3:timestamp, 4:version, 5:username saved_by, 6:ws_id, 7:ws_name, 8 chsum, 9 size, 10:usermeta
                var refInfo =data[i].info;
                var objId = refInfo[6] + '/' + refInfo[0] + '/' + refInfo[4];
                var objIdGen = refInfo[6] + '/' + refInfo[0];

                var nodeId;
                if(existingNodeGraphId[objIdGen] !== undefined){
                    nodeId = existingNodeGraphId[objIdGen];
                    combineGraph.nodes[nodeId].versions[refInfo[4]] = true;
                }else{
                    var t = refInfo[2].split('-')[0];
                    var endNode = ((data[i].provenance.length + data[i].refs.length) > 0) ? false : true;
                    var versionSet = {};
                    versionSet[refInfo[4]] = true;
                    var node = {
                        name: getNodeLabel(refInfo),
                        objId: objId,
                        type: t,
                        data: data[i],
                        endNode: endNode,
                        versions : versionSet,
                        referencesFrom: [],
                        referencesTo: []
                    };
                    nodeId = combineGraph.nodes.length;

                    existingNodeGraphId[objIdGen] = nodeId;
                    combineGraph.nodes.push(node);
                }   
      
                makeLink(targetId, nodeId, isDep);
                
            }
        }
        function getReferencingObjects(objectIdentity) {
            //workspace requires list for referencing objects
            return workspace.list_referencing_objects([objectIdentity])
                .then(function(refData){
                    var objectIds = getObjectIds(refData[0]);
                    if(refData[0].length === 0){return null;}
                    return workspace.get_objects2({
                        objects: objectIds,
                        no_data: 1
                    }).then(refHelper.bind(null,objectIdentity));
                })
                .catch(function(){
                    //will not look for references of object you don't have access to
                });
        }
        function refHelper(objectIdentity, provData){
            for (var i = 0; i < provData.data.length; i++) {
                var data = provData.data[i];
                if (exemptObjects[data.info[2].split('-')[0]]) continue;

                for (var j = 0; j < data.refs.length; j++) {
                    if (objectIdentity.ref === data.refs[j]) {
                        var isDep = true;
                        var objIdGen = objectIdentity.ref.split('/').slice(0, 2).join('/');
                        addNodeLink([data], existingNodeGraphId[objIdGen], isDep);
                        break;
                    }
                }
                for (var k = 0; k < data.provenance.length; k++) {
                    var provenance = data.provenance[k];
                    var refInfo = data.info;
                    var objIdGen = refInfo[6] + '/' + refInfo[0];
                    var functionNode = makeFunctionNode(provenance, objIdGen, provenance.script);

                    var isDep = false;
                    if (provenance.resolved_ws_objects.length > 0) {
                        var functionId = addFunctionLink(objectIdentity, functionNode, isDep);
                        addNodeLink([data], functionId, isDep);
                    }
                }
            }

        }

        function makeLink(target, source, isDep) {
            var name = source + 'to' + target;

            if (!existingLinks[name]){
                existingLinks[name] = true;
                var link =  {
                    source: source,
                    target: target,
                    isDep: isDep
                };
                combineGraph.links.push(link);
                combineGraph.nodes[source].referencesTo.push(link);
                combineGraph.nodes[target].referencesFrom.push(link);
            }

        }

        function makeFunctionNode(provenance, objIdGen, isScript){
            if(isScript){
                return {
                    isFunction: true,
                    type: 'Script',
                    objId: objIdGen + 'to' + provenance.script,
                    name: provenance.script,
                    method: provenance.script,
                    referencesFrom: [],
                    referencesTo: []
                };
            }else {
                return {
                    isFunction: true,
                    type: 'App',
                    objId: objIdGen + 'to' + provenance.service,
                    name: provenance.service,
                    method: provenance.method,
                    referencesFrom: [],
                    referencesTo: []
                };
            }
        }

        function getObjectProvenance(objectIdentity){
            var path = nodePaths[objectIdentity.ref];
            var objectPath = (path)? ({ref:path}) : objectIdentity;
            //TODO: global unique provenance items
            //had to wrap identity in array as it somehow wanted a list
            return workspace.get_objects2({
                objects:[objectPath],
                no_data: 1
            })
                .then(function(provData){
                    return provData.data;
                })
                .then(provHelper.bind(null, objectIdentity, true));
        }
        function provHelper(objectIdentity, isProv, provDataSet) {
            var functionNode, functionId;

            var uniqueRefs = {},
                uniqueProvPaths = [],
                uniqueRefPaths = [];
            for (var i = 0; i < provDataSet.length; i++) {

                var objectProvenance = provDataSet[i];
                objectProvenance.provenance.forEach(function (provenance) {
                    var objIdGen = objectIdentity.ref.split('/').slice(0, 2).join('/');
                    functionNode = makeFunctionNode(provenance, objIdGen, provenance.script);

                    var isDep = false;
                    functionId = addFunctionLink(objectIdentity, functionNode, isDep);
                    if (provenance.resolved_ws_objects) {
                        provenance.resolved_ws_objects.forEach(function (resolvedObjectRef) {

                            if (!(resolvedObjectRef in uniqueRefs)) {
                                uniqueRefs[resolvedObjectRef] = 'included';
                                if (nodePaths[objectIdentity.ref] === undefined) nodePaths[objectIdentity.ref] = objectIdentity.ref;
                                var path = nodePaths[objectIdentity.ref] + ';' + resolvedObjectRef;
                                nodePaths[resolvedObjectRef] = path;
                                uniqueProvPaths.push({ ref: path });
                            }
                        });
                    }
                });

                
                var dependencies = provDataSet[i].refs;
                for (var j = 0; j < dependencies.length; j++) {
                    var prevPath = nodePaths[objectIdentity.ref];
                    if (!prevPath) {
                        prevPath = objectIdentity.ref;
                        nodePaths[objectIdentity.ref] = prevPath;
                    }
                    var path = nodePaths[dependencies[j]];
                    if(path === undefined){                       
                        path = prevPath + ';' + dependencies[j];
                        nodePaths[dependencies[j]] = path;
                    }
    
                    uniqueRefPaths.push({ ref: path });
                }
    
                if (uniqueProvPaths.length > 0) {
                //get_object_info_new deprecated. new method only availble on generic client
                    return Promise.all([client.callFunc('get_objects2', [{
                        objects: uniqueProvPaths,
                        no_data: 1
                    }]), objectIdentity, functionId])
                        .spread(function (refData, objectIdentity, functionId) {
                            if (refData !== null || exemptObjects[refData[0].data.info[2].split('-')[0]]) {
                                refData = refData[0].data;
                                var isDep = false;                                
                                addNodeLink(refData, functionId, isDep, null, refData);

                            }
                        });

                } 
                else if (uniqueRefPaths.length > 0) {
                    return Promise.all([client.callFunc('get_objects2', [{
                        objects: uniqueRefPaths,
                        no_data: 1,
                        ignoreErrors:1
                    }]), objectIdentity])
                        .spread(function (refData, objectIdentity) {
                        //generic client wrapped result in an array.    
                            if (refData !== null) {
                                refData = refData[0].data;
                                var isDep = true;
                                var objIdGen = objectIdentity.ref.split('/').slice(0, 2).join('/');
                                var objId = existingNodeGraphId[objIdGen];
                                addNodeLink(refData, objId, isDep, refData);
                            }
                        });
           
                }
            } 
               
            
        }


        function buildDataAndRender(objref) {
            $container.find('#loading-mssg').show();
            $container.find('#objgraphview2').hide();

            workspace.get_objects2({
                objects: [objref],
                no_data: 1
            })
                .then(function (objData) {
                    return processObjectHistory(objData.data);
                })
                .then(function (objectIdentity) {   
                    return Promise.all([
                        getObjectProvenance(objectIdentity),
                        getReferencingObjects(objectIdentity)
                    ]);
                })
                .then(function () {
                    finishUpAndRender();
                })
                .catch(function (err) {
                    showError(err);
                });

        }          

        function renderForceTree(nodesData, linksData){
            //TODO: copy loop through nodes and get provenances, with nodes hidden
            var width = svgWidth,
                height = svgHeight,
                oldNodes, // data
                svg, node, link,
                nodes = nodesData,
                links = linksData,
                t = d3.transition()
                    .duration(1750); // d3 selections

            var force = d3.layout.force()
                .charge(-1800)
                .linkDistance(30)
                .size([width, height]);

            force.drag()
                .on('dragstart', dragstart)
                .on('dragend', dragstop);

            force.on('tick', tick);
            svg = d3.select($container.find('#objgraphview2')[0])
                .append('svg')
                .attr('width', width)
                .attr('height', height)
                .attr('class', 'prov');
            
            var background = svg.append('rect')
                .attr('x', 0)
                .attr('y', 0)
                .attr('height', height)
                .attr('width', width)
                .style('fill', '#efefef')
                .style('stroke-width', 0);

            function update() {
                svg.attr('height', svgHeight)
                    .attr('width', svgWidth);
                background.attr('height', svgHeight)
                    .attr('width', svgWidth);
                force.nodes(nodes).links(links);
                var n = svg.selectAll('.node')
                    .data(nodes, function (d) { return d.objId; });
                var l = svg.selectAll('.link')
                    .data(links, function(d) {return d.source + ',' + d.target;});

                enterLinks(l);
                enterNodes(n);
                link = svg.selectAll('.link');
                node = svg.selectAll('.node');
                force.start();
                force.tick();
                force.stop();
            }

            function enterNodes(n) {
                oldNodes = [];
     
                var g = n.enter()
                    .append('g')
                    .attr('class', 'node')
                    .each(function (d) {oldNodes.push(d);})
                    .on('click', onNodeClick)
                    .call(force.drag);

                var rect = g.append('rect')
                    .attr('class', 'nodeObj')
                    .attr('x', -rectWidth/2)
                    .attr('y', -rectHeight/2)
                    .attr('width', rectWidth)
                    .attr('height', rectHeight)
                    .attr('stroke-width', '1px')
                    .on('dblclick', dblClick)
                    .attr('stroke', getBorderColor)
                    .attr('rx', function(d){return d.isFunction ? rectWidth/2 : 0;})
                    .attr('ry', function(d){return d.isFunction ? rectWidth/2 : 0;})
                    .on('mouseover', function (d) {
                        d3.select(this)
                            .attr('stroke-width', '3px');
                    })
                    .on('mouseleave', function(d){
                        d3.select(this)
                            .attr('stroke-width', '1px');
                    })
                    .transition(t);
                d3.selectAll('.nodeObj').each(function (d){

                    if(!(d.versions === undefined)){
                        for (var i = 1; i < Object.keys(d.versions).length; i++){
                            d3.select(this.parentNode).insert('rect', ':first-child')
                                .attr('class', 'versions')
                                .attr('x', -rectWidth/2 + i*5)
                                .attr('y', -rectHeight/2 - i*5)
                                .attr('width', rectWidth)
                                .attr('height', rectHeight)
                                .attr('stroke-width', '1px')
                                .attr('stroke', getBorderColor)
                                .on('mouseover', function () {
                                    d3.select(this)
                                        .attr('stroke-width', '3px');
                                })
                                .on('mouseleave', function () {
                                    d3.select(this)
                                        .attr('stroke-width', '1px');
                                });
                        }
                    }
                });

                g.append('title')
                    .html(function (d) {
                        //0:obj_id, 1:obj_name, 2:type ,3:timestamp, 4:version, 5:username saved_by, 6:ws_id, 7:ws_name, 8 chsum, 9 size, 10:usermeta
                        var text = 'Type: ' + d.type +'\n' 
                                    + 'Name: ' + d.name;
                        if(!d.isFunction){
                            var info = d.data.info;
                            text += '\n' + 'Saved on:  ' + getTimeStampStr(info[3]) + '\n' +
                                'Saved by:  ' + info[5];
                        }
                        return text;
                    });
               

                g.transition;
        
                var text = g.append('text')
                    .attr('fill', 'black');
                //   .attr("dy", ".35em")
                text.append('tspan')
                    .text(function (d) { 
                        return (d.type.length < 15) ? d.type : (d.type.slice(0, 10) + '...');
                    })                    
                    .attr('font-weight', 'bold')
                    .attr('x', function (d) {return (-rectWidth / 2) + (d.isFunction ? 40 : 5);})
                    .attr('y', -rectHeight/2 + 15)
                    .attr('dy', 0);

                text.append('tspan')
                    .attr('dy', 15)
                    .attr('x', function (d) { return (-rectWidth / 2) + (d.isFunction ? 12 : 5); })
                    .attr('y', -rectHeight/2 + 15)
                    .text(function (d) { 
                        if(d.isFunction){
                            return (d.name.length < 12) ? d.name : (d.name.slice(0, 9) + '...'); 
                        }
                        return (d.name.length < 20) ? d.name : (d.name.slice(0, 12) + '...'); 
                    });                    

            }

            function enterLinks(l) {
                l.enter()
                    .insert('line', '.node')
                    .attr('class', 'link')
                    .attr('id', function(d){return '#path' + d.source + '_' + d.target;})
                    .attr('marker-end', 'url(#markerArrow)')
                    .transition(t)
                    .style('stroke-dasharray', function(d) {
                        if(d.isDep) return ('3, 3');
                        return ('10,0');})
                    .style('stroke-width', '5');

                var dummyData = [1];
                //marker
                svg.append('svg:defs')
                    .selectAll('marker')
                    .data(dummyData)
                    .enter()
                    .append('svg:marker')
                    .attr('id', 'markerArrow')
                    .attr('markerHeight', 3)
                    .attr('markerWidth', 3)
                    .attr('refX', 5)
                    .attr('orient', 'auto')
                    .attr('viewBox', '-5 -5 10 10')
                    .append('svg:path')
                    .attr('d', 'M 0,0 m -5,-5 L 5,0 L -5,5 Z')
                    .attr('fill', 'blue');
            }

            function maintainNodePositions() {
                oldNodes.forEach( function(d) {
                    d.fixed = true;
                });
            }
         
            function dragstart(d) {
                d.fixed = true;
                force.stop();
            }
            function dragstop(d){
                d.fixed = true;
                force.stop();
            }

            function tick(e) {
                node
                    .attr('cx', function (d) { 
                        return d.x = Math.max(rectWidth/2, Math.min(svgWidth - rectWidth/2, d.x)); 
                    })
                    .attr('cy', function (d) { 
                        return d.y = Math.max(rectHeight / 2, Math.min(svgHeight - rectHeight / 2, d.y)); 
    
                    })
                    .attr('transform', function (d) { return 'translate(' + d.x + ',' + d.y + ')'; })
                    .style('fill', function (d) {
                        if (d.isFunction) return types.functionNode.color;
                        if (d.startingObject) return types.startingNode.color;
                        if (d.endNode || d.expanded) return types.noRefs.color;
                        return types.node.color;
                    })
                    .attr('display', function (d) { return (d.toggle === false) ? 'none' : 'initial';});

                link
                    .attr('x1', function (d) { return d.source.x; })
                    .attr('y1', function (d) { return d.source.y + rectHeight/2; })
                    .attr('x2', function (d) { return d.target.x; })
                    .attr('y2', function (d) { return d.target.y - rectHeight/2; })
                    .attr('display', function (d) { return (d.toggle === false) ? 'none' : 'initial'; });

            }
            force.on('end', function(e){
                oldNodes = nodes;
                maintainNodePositions();

            });
            function getBorderColor(type){
                if (type.isFunction) return types.functionNode.borderColor;
                if (type.startingObject) return types.startingNode.borderColor;
                return types.node.borderColor;
            }
            function dblClick(node){
                var nodeId = {ref: node.objId};
                if(node.isPresent || node.isFunction){
                    if(node.startingObject && (node.expanded === undefined)) node.expanded = true;
                    node.expanded = !node.expanded;
                    var condition = node.expanded;
                    
                    toggleNode(node, condition);
                    update();   
                }
                else if (!node.endNode){

                    node.expanded = true;
                    return Promise.all([
                        provHelper(nodeId, true, [node.data]),
                        getReferencingObjects(nodeId)
                    ])
                        .then(function(){
                            nodes = dagreNodes();
                            update();
                            node.isPresent = true;
                        });
                }
            }
            function toggleNode(node){
                var condition = node.expanded;
                var queue = addLinkstoQueue(node.referencesTo);
                while (queue.length > 0){
                    var link = queue.pop();
                    link.toggle = condition;
                    if((condition === false && !hasLinkDep(link.target)) || (condition === true && condition !== link.target.toggle)){
                        if (!(link.target.expanded === false && condition === true)){
                            queue = queue.concat(addLinkstoQueue(link.target.referencesTo));
                        }
                        link.target.toggle = condition;
                    } 
                }
            }
            function addLinkstoQueue (links){
                var queue = [];
                for(var i =0; i< links.length; i++){
                    queue.push(links[i]);
                }
                return queue;
            }
            function hasLinkDep(node){
                var links = node.referencesFrom;

                for(var i = 0; i<links.length; i++){
                    if(links[i].toggle !== false) return true;
                }
                return false;
            }
            update();
        }
        
        function finishUpAndRender() {
            d3.select($container.find('#objgraphview2')).html('');
            $container.find('#objgraphview2').show();
            renderForceTree(dagreNodes(), combineGraph.links, false);
            addNodeColorKey();
            $container.find('#loading-mssg').hide();
        }
        function dagreNodes(){
            // Set an object for the graph label
            dgraph.setGraph({});

            // Default to assigning a new object as a label for each new edge.
            dgraph.setDefaultEdgeLabel(function () { return {}; });

            //add nodes into dgraph
            for(var i =0; i<combineGraph.nodes.length; i++){
                var node = combineGraph.nodes[i];
                node.height = rectHeight;
                node.width = rectWidth;
                node.index = i;
                var nodeInfo = Object.assign({}, node);
                nodeInfo.label = node.name;

                dgraph.setNode(node.objId, nodeInfo);
            }
            //add links to dgraph
            for (var i = 0; i < combineGraph.links.length; i++) {
                var link = combineGraph.links[i];
                //d3 sometimes mutates the integers to references of the actual object. Manually changing it back b/c of dagre only takes numbers or labels
                if (isNaN(link.source)){
                    link.source = link.source.index;
                    link.target = link.target.index;
                }
                dgraph.setEdge(combineGraph.nodes[link.source].objId, combineGraph.nodes[link.target].objId);
                
            }

            dagre.layout(dgraph);
            var nodes = [];
            var nodeLabels = dgraph.nodes();
            for (var i = 0; i < nodeLabels.length; i++) {
                nodes.push(dgraph.node(nodeLabels[i]));
            }

            svgHeight = dgraph._label.height;
            svgWidth = dgraph._label.width;
            return nodes;

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

            var objectIdentity = getObjectIdentity(params.workspaceId, params.objectId);
            buildDataAndRender(objectIdentity);
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
