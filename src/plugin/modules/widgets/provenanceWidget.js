/*global define */
/*jslint browser: true, white: true */
define([
    'bluebird',
    'jquery',
    'd3',
    'kb_common/html',
    'kb_common/dom',
    'kb_service/client/workspace',
    'd3_sankey'
],
    function (Promise, $, d3, html, dom, Workspace) {
        'use strict';

        function widget(config) {
            var mount, container, $container, runtime = config.runtime,
                workspaceId, objectId,
                objRefToNodeIdx,
                needColorKey = true,
                workspace = new Workspace(runtime.getConfig('services.workspace.url'), {
                    token: runtime.service('session').getAuthToken()
                }),
                types = {
                    selected: {
                        color: '#FF9800',
                        name: 'Current version'
                    },
                    core: {
                        color: '#FF9800',
                        name: 'All Versions of this Data'
                    },
                    ref: {
                        color: '#C62828',
                        name: 'Data Referencing this Data'
                    },
                    included: {
                        color: '#2196F3',
                        name: 'Data Referenced by this Data'
                    },
                    none: {
                        color: '#FFFFFF',
                        name: ''
                    },
                    copied: {
                        color: '#4BB856',
                        name: 'Copied From'
                    }
                },
                monthLookup = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
                graph = {
                    nodes: [],
                    links: []
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
                    div(['This is a visualization of the relationships between this piece of data and other data in KBase.  Mouse over objects to show additional information (shown below the graph). Double click on an object to select and recenter the graph on that object in a new window.', br(), br()]),
                    div({ id: 'objgraphview', style: { overflow: 'auto', height: '450px', resize: 'vertical' } }),
                    div({ id: 'nodeColorKey' })
                ]);
            }

            /* Construct an ObjectIdentity that can be used to query the WS*/
            function getObjectIdentity(wsNameOrId, objNameOrId, objVer) {
                if (objVer) {
                    return { ref: wsNameOrId + "/" + objNameOrId + "/" + objVer };
                }
                return { ref: wsNameOrId + "/" + objNameOrId };
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

            //should be a struct with fields of type name, values are type info.  type info has 'info', 'refs'
            //'prov'
            //objData: {},
            // maps ws REF to graph node id
            //objRefToNodeIdx: null,
            // the actual graph data
            //graph: null,

            function addNodeColorKey() {
                if (needColorKey) {
                    needColorKey = false;
                    var content = table({ cellpadding: '0', cellspacing: '0', border: '0', width: '100%', style: { border: '1px silver solid; padding: 4px;' } }, [
                        tr([
                            td({ valign: 'top' }, [
                                table({ cellpadding: '2', cellspacing: '0', border: '0', id: 'graphkey', style: '' },
                                    Object.keys(types).map(function (type) {
                                        if (type === 'selected') {
                                            return;
                                        }
                                        if (types[type].name === '') {
                                            return;
                                        }
                                        return tr([
                                            td([
                                                svg({ width: '40', height: '20' }, [
                                                    rect({ x: '0', y: '0', width: '40', height: '20', fill: types[type].color })
                                                ])
                                            ]),
                                            td({ valign: 'middle' }, [
                                                types[type].name
                                            ])
                                        ]);
                                    }).filter(function (x) {
                                        if (x === undefined) {
                                            return false;
                                        }
                                        return true;
                                    }))
                            ]),
                            td([
                                div({ id: 'objdetailsdiv' })
                            ])
                        ])
                    ]);
                    $('#nodeColorKey').html(content);
                }
            }

            function nodeMouseover(d) {
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


            function renderSankeyStyleGraph() {
                var margin = { top: 10, right: 10, bottom: 10, left: 10 },
                    width = config.width - 50 - margin.left - margin.right,
                    height = graph.nodes.length * 38 - margin.top - margin.bottom,
                    color = d3.scale.category20(),
                    svg, sankey, path, link, node;
                if (graph.links.length === 0) {
                    // in order to render, we need at least two nodes
                    graph.nodes.push({
                        node: 1,
                        name: "No references found",
                        info: [-1, "No references found", "No Type", 0, 0, "N/A", 0, "N/A", 0, 0, {}],
                        nodeType: "none",
                        objId: "-1",
                        isFake: true
                    });
                    objRefToNodeIdx["-1"] = 1;
                    graph.links.push(makeLink(0, 1, 1));
                }

                if (height < 450) {
                    $container.find("#objgraphview").height(height + 40);
                }
                /*var zoom = d3.behavior.zoom()
                 .translate([0, 0])
                 .scale(1)
                 .scaleExtent([1, 8])
                 .on("zoom", function() {
                 features.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
                 //features.select(".state-border").style("stroke-width", 1.5 / d3.event.scale + "px");
                 //features.select(".county-border").style("stroke-width", .5 / d3.event.scale + "px");
                 });
                 */
                // append the svg canvas to the page
                d3.select($container.find("#objgraphview")[0]).html("");
                $container.find('#objgraphview').show();
                svg = d3.select($container.find("#objgraphview")[0]).append("svg");
                svg
                    .attr("width", width + margin.left + margin.right)
                    .attr("height", height + margin.top + margin.bottom)
                    .append("g")
                    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

                // Set the sankey diagram properties
                sankey = d3.sankey()
                    .nodeWidth(25)
                    .nodePadding(40)
                    .size([width, height]);

                path = sankey.link();
                sankey
                    .nodes(graph.nodes)
                    .links(graph.links)
                    .layout(40);

                // add in the links
                link = svg.append("g").selectAll(".link")
                    .data(graph.links)
                    .enter().append("path")
                    .attr("class", "sankeylink")
                    .attr("d", path)
                    .style("stroke-width", function (d) {
                        return 10; /*Math.max(1, d.dy);*/
                    })
                    .sort(function (a, b) {
                        return b.dy - a.dy;
                    });

                // add the link titles
                link.append("title")
                    .text(function (d) {
                        if (d.source.nodeType === 'copied') {
                            d.text = d.target.name + ' copied from ' + d.source.name;
                        } else if (d.source.nodeType === 'core') {
                            d.text = d.target.name + ' is a newer version of ' + d.source.name;
                        } else if (d.source.nodeType === 'ref') {
                            d.text = d.source.name + ' references ' + d.target.name;
                        } else if (d.source.nodeType === 'included') {
                            d.text = d.target.name + ' references ' + d.source.name;
                        }
                        return d.text;
                    });
                $(link).tooltip({ delay: { "show": 0, "hide": 100 } });

                // add in the nodes
                node = svg.append("g")
                    .selectAll(".node")
                    .data(graph.nodes)
                    .enter().append("g")
                    .attr("class", "sankeynode")
                    .attr("transform", function (d) {
                        return "translate(" + d.x + "," + d.y + ")";
                    })
                    .call(d3.behavior.drag()
                        .origin(function (d) {
                            return d;
                        })
                        .on("dragstart", function () {
                            this.parentNode.appendChild(this);
                        })
                        .on("drag",
                        function (d) {
                            d.x = Math.max(0, Math.min(width - d.dx, d3.event.x));
                            d.y = Math.max(0, Math.min(height - d.dy, d3.event.y));
                            d3.select(this).attr("transform",
                                "translate(" + d.x + "," + d.y + ")");
                            sankey.relayout();
                            link.attr("d", path);
                        }))
                    .on('dblclick', function (d) {
                        if (d3.event.defaultPrevented) {
                            return;
                        }
                        // TODO: toggle switch between redirect vs redraw

                        // alternate redraw
                        //self.$elem.find('#objgraphview').hide();
                        //self.buildDataAndRender({ref:d['objId']});

                        //alternate reload page so we can go forward and back
                        if (d.isFake) {
                            // Oh, no!
                            alert("Cannot expand this node.");
                        } else {
                            //if (d.info[1].indexOf(' ') >= 0) {
                            //    // TODO: Fix this
                            //    window.location.href = "#provenance/" + encodeURI(d.info[7] + "/" + d.info[0]);
                            //} else {
                            // TODO: Fix this
                            runtime.navigate("provenance/" + encodeURI(d.info[6] + "/" + d.info[0] + '/' + d.info[4]));
                            //}
                        }
                    })
                    .on('mouseover', nodeMouseover);

                // add the rectangles for the nodes
                node.append("rect")
                    .attr("y", function (d) {
                        return -5;
                    })
                    .attr("height", function (d) {
                        return Math.abs(d.dy) + 10;
                    })
                    .attr("width", sankey.nodeWidth())
                    .style("fill", function (d) {
                        return d.color = types[d['nodeType']].color;
                    })
                    .style("stroke", function (d) {
                        return 0 * d3.rgb(d.color).darker(2);
                    })
                    .append("title")
                    .html(function (d) {
                        //0:obj_id, 1:obj_name, 2:type ,3:timestamp, 4:version, 5:username saved_by, 6:ws_id, 7:ws_name, 8 chsum, 9 size, 10:usermeta
                        var info = d.info;
                        var text =
                            info[1] + " (" + info[6] + "/" + info[0] + "/" + info[4] + ")\n" +
                            "--------------\n" +
                            "  type:  " + info[2] + "\n" +
                            "  saved on:  " + getTimeStampStr(info[3]) + "\n" +
                            "  saved by:  " + info[5] + "\n";
                        var found = false;
                        var metadata = "  metadata:\n";
                        for (var m in info[10]) {
                            text += "     " + m + " : " + info[10][m] + "\n";
                            found = true;
                        }
                        if (found) {
                            text += metadata;
                        }
                        return text;
                    });

                // add in the title for the nodes
                node.append("text")
                    .attr("y", function (d) {
                        return d.dy / 2;
                    })
                    .attr("dy", ".35em")
                    .attr("text-anchor", "end")
                    .attr("transform", null)
                    .text(function (d) {
                        return d.name;
                    })
                    .filter(function (d) {
                        return d.x < width / 2;
                    })
                    .attr("x", 6 + sankey.nodeWidth())
                    .attr("text-anchor", "start");
                return this;
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
                    td({ style: { maxWidth: '250px' } }, [
                        b(rowTitle)
                    ]),
                    td({ style: { maxWidth: '300px' } }, [
                        div({ style: { maxWidth: '300px', maxHeight: '250px', overflowY: 'auto', whiteSpace: 'pre', wordWrap: 'break-word' } }, [
                            rowContent
                        ])
                    ])
                ]);
            }
            function getNodeLabel(info) {
                return info[1] + " (v" + info[4] + ")";
            }

            function processObjectHistory(data) {
                var objIdentities = [],
                    latestVersion = 0,
                    latestObjId = "";

                // These are global.
                objRefToNodeIdx = {};
                graph = {
                    nodes: [],
                    links: []
                };

                data.forEach(function (objectInfo) {
                    //0:obj_id, 1:obj_name, 2:type ,3:timestamp, 4:version, 5:username saved_by, 6:ws_id, 7:ws_name, 8 chsum, 9 size, 10:usermeta
                    var t = objectInfo[2].split("-")[0],
                        objId = objectInfo[6] + "/" + objectInfo[0] + "/" + objectInfo[4],
                        nodeId = graph.nodes.length;
                    graph.nodes.push({
                        node: nodeId,
                        name: getNodeLabel(objectInfo),
                        info: objectInfo,
                        nodeType: "core",
                        objId: objId
                    });
                    if (objectInfo[4] > latestVersion) {
                        latestVersion = objectInfo[4];
                        latestObjId = objId;
                    }
                    objRefToNodeIdx[objId] = nodeId;
                    objIdentities.push({ ref: objId });
                });
                if (latestObjId.length > 0) {
                    graph.nodes[objRefToNodeIdx[latestObjId].nodeType] = 'selected';
                }
                return objIdentities;
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

            function getReferencingObjects(objIdentities) {
                return workspace.list_referencing_objects(objIdentities)
                    .then(function (refData) {
                        for (var i = 0; i < refData.length; i++) {
                            var limit = 50;
                            for (var k = 0; k < refData[i].length; k++) {
                                if (k >= limit) {
                                    //0:obj_id, 1:obj_name, 2:type ,3:timestamp, 4:version, 5:username saved_by, 6:ws_id, 7:ws_name, 8 chsum, 9 size, 10:usermeta
                                    var nodeId = graph['nodes'].length,
                                        nameStr = refData[i].length - limit + " more ...";
                                    graph['nodes'].push({
                                        node: nodeId,
                                        name: nameStr,
                                        info: [-1, nameStr, "Multiple Types", 0, 0, "N/A", 0, "N/A", 0, 0, {}],
                                        nodeType: "ref",
                                        objId: "-1",
                                        isFake: true
                                    });
                                    objRefToNodeIdx[objId] = nodeId;

                                    // add the link now too
                                    if (objRefToNodeIdx[objIdentities[i]['ref']] !== null) {  // only add the link if it is visible
                                        graph['links'].push({
                                            source: objRefToNodeIdx[objIdentities[i]['ref']],
                                            target: nodeId,
                                            value: 1
                                        });
                                    }
                                    break;
                                }

                                var refInfo = refData[i][k];
                                //0:obj_id, 1:obj_name, 2:type ,3:timestamp, 4:version, 5:username saved_by, 6:ws_id, 7:ws_name, 8 chsum, 9 size, 10:usermeta
                                var t = refInfo[2].split("-")[0];
                                var objId = refInfo[6] + "/" + refInfo[0] + "/" + refInfo[4];
                                var nodeId = graph['nodes'].length;
                                graph['nodes'].push({
                                    node: nodeId,
                                    name: getNodeLabel(refInfo),
                                    info: refInfo,
                                    nodeType: "ref",
                                    objId: objId
                                });
                                objRefToNodeIdx[objId] = nodeId;

                                // add the link now too
                                if (objRefToNodeIdx[objIdentities[i].ref] !== null) {  // only add the link if it is visible
                                    graph.links.push(makeLink(objRefToNodeIdx[objIdentities[i].ref], nodeId, 1));
                                }
                            }
                        }
                    });
            }

            function makeLink(source, target, value) {
                return {
                    source: source,
                    target: target,
                    value: value
                };
            }

            function getObjectProvenance(objIdentities) {
                return workspace.get_object_provenance(objIdentities)
                    .then(function (objdata) {
                        var uniqueRefs = {},
                            uniqueRefObjectIdentities = [],
                            links = [];

                        objdata.forEach(function (objectProvenance) {
                            var objRef = getObjectRef(objectProvenance.info);

                            // extract the references contained within the object
                            objectProvenance.refs.forEach(function (ref) {
                                if (!(ref in uniqueRefs)) {
                                    uniqueRefs[ref] = 'included';
                                    uniqueRefObjectIdentities.push({ ref: ref });
                                }
                                links.push(makeLink(ref, objRef, 1));
                            });

                            // extract the references from the provenance                            
                            objectProvenance.provenance.forEach(function (provenance) {
                                if (provenance.resolved_ws_objects) {
                                    provenance.resolved_ws_objects.forEach(function (resolvedObjectRef) {
                                        if (!(resolvedObjectRef in uniqueRefs)) {
                                            uniqueRefs[resolvedObjectRef] = 'included'; // TODO switch to prov??
                                            uniqueRefObjectIdentities.push({ ref: resolvedObjectRef });
                                        }
                                        links.push(makeLink(resolvedObjectRef, objRef, 1));
                                    });
                                }
                            });

                            // copied from
                            if (objectProvenance.copied) {
                                var copyShort = objectProvenance.copied.split('/')[0] + '/' + objectProvenance.copied.split('/')[1];
                                var thisShort = getObjectRefShort(objectProvenance.info);
                                if (copyShort !== thisShort) { // only add if it wasn't copied from an older version
                                    if (!(objectProvenance.copied in uniqueRefs)) {
                                        uniqueRefs[objectProvenance.copied] = 'copied'; // TODO switch to prov??
                                        uniqueRefObjectIdentities.push({ ref: objectProvenance.copied });
                                    }
                                    links.push(makeLink(objectProvenance.copied, objRef, 1));
                                }
                            }
                        });
                        return {
                            uniqueRefs: uniqueRefs,
                            uniqueRefObjectIdentities: uniqueRefObjectIdentities,
                            links: links
                        };
                    });
            }

            function isUndefNull(obj) {
                if (obj === null || obj === undefined) {
                    return true;
                }
                return false;
            }

            function getObjectInfo(refData) {
                return workspace.get_object_info_new({
                    objects: refData['uniqueRefObjectIdentities'],
                    includeMetadata: 1,
                    ignoreErrors: 1
                })
                    .then(function (objInfoList) {
                        var objInfoStash = {};
                        for (var i = 0; i < objInfoList.length; i++) {
                            if (objInfoList[i]) {
                                objInfoStash[objInfoList[i][6] + "/" + objInfoList[i][0] + "/" + objInfoList[i][4]] = objInfoList[i];
                            }
                        }
                        // add the nodes
                        var uniqueRefs = refData.uniqueRefs;
                        for (var ref in uniqueRefs) {
                            var refInfo = objInfoStash[ref];
                            if (refInfo) {
                                //0:obj_id, 1:obj_name, 2:type ,3:timestamp, 4:version, 5:username saved_by, 6:ws_id, 7:ws_name, 8 chsum, 9 size, 10:usermeta
                                var t = refInfo[2].split("-")[0];
                                var objId = refInfo[6] + "/" + refInfo[0] + "/" + refInfo[4];
                                var nodeId = graph.nodes.length;
                                graph.nodes.push({
                                    node: nodeId,
                                    name: getNodeLabel(refInfo),
                                    info: refInfo,
                                    nodeType: uniqueRefs[ref],
                                    objId: objId
                                });
                                objRefToNodeIdx[objId] = nodeId;
                            } else {
                                // there is a reference, but we no longer have access; could do something better
                                // here, but instead we just skip
                                // At least warn... there be bugs if this happens...
                                console.warn('In provenance widget reference ' + ref + ' is not accessible');
                            }
                        }
                        // add the link info
                        refData.links.forEach(function (link) {
                            if (isUndefNull(objRefToNodeIdx[link.source]) || isUndefNull(objRefToNodeIdx[link.target])) {
                                console.warn('skipping link', link);
                            } else {
                                graph.links.push(makeLink(objRefToNodeIdx[link.source], objRefToNodeIdx[link.target], link.value));
                            }
                        });
                    })
                    .catch(function (err) {
                        // we couldn't get info for some reason, could be if objects are deleted or not visible
                        var uniqueRefs = refData['uniqueRefs'];
                        for (var ref in uniqueRefs) {
                            var nodeId = graph['nodes'].length;
                            var refTokens = ref.split("/");
                            graph['nodes'].push({
                                node: nodeId,
                                name: ref,
                                info: [refTokens[1], "Data not found, object may be deleted",
                                    "Unknown", "", refTokens[2], "Unknown", refTokens[0],
                                refTokens[0], "Unknown", "Unknown", {}],
                                nodeType: uniqueRefs[ref],
                                objId: ref
                            });
                            objRefToNodeIdx[ref] = nodeId;
                        }
                        // add the link info
                        var links = refData['links'];
                        for (var i = 0; i < links.length; i++) {
                            graph['links'].push(makeLink(objRefToNodeIdx[links[i]['source']], objRefToNodeIdx[links[i]['target']], links[i]['value']));
                        }
                    });
            }

            function buildDataAndRender(objref) {
                // init the graph
                $container.find('#loading-mssg').show();
                $container.find('#objgraphview').hide();
                graph = { nodes: [], links: [] };

                workspace.get_object_history(objref)
                    .then(function (data) {
                        return processObjectHistory(data);
                    })
                    .then(function (objIdentities) {
                        // we have the history of the object of interest, 
                        // now we can fetch all referencing object, and 
                        // get prov info for each of these objects
                        return Promise.all([
                            getReferencingObjects(objIdentities),
                            getObjectProvenance(objIdentities)
                        ]);
                    })
                    .spread(function (ignore, refData) {
                        if (refData && 'uniqueRefObjectIdentities' in refData) {
                            if (refData.uniqueRefObjectIdentities.length > 0) {
                                return getObjectInfo(refData);
                            }
                        }
                    })
                    .finally(function () {
                        finishUpAndRender();
                    })
                    .catch(function (err) {
                        showError(err);
                    });

            }
            function finishUpAndRender() {
                addVersionEdges();
                renderSankeyStyleGraph();
                addNodeColorKey();
                $container.find('#loading-mssg').hide();
            }
            function addVersionEdges() {
                //loop over graph nodes, get next version, if it is in our node list, then add it
                var expectedNextVersion, expectedNextId;
                graph.nodes.forEach(function (node) {
                    if (node.nodeType === 'copied') {
                        return;
                    }
                    //0:obj_id, 1:obj_name, 2:type ,3:timestamp, 4:version, 5:username saved_by, 6:ws_id, 7:ws_name, 8 chsum, 9 size, 10:usermeta
                    expectedNextVersion = node.info[4] + 1;
                    expectedNextId = node.info[6] + "/" + node.info[0] + "/" + expectedNextVersion;
                    if (objRefToNodeIdx[expectedNextId]) {
                        // add the link now too
                        graph.links.push(makeLink(objRefToNodeIdx[node.objId], objRefToNodeIdx[expectedNextId], 1));
                    }
                });
            }
            function getData() {
                return { title: "Data Object Reference Network", workspace: workspaceId, id: "This view shows the data reference connections to object " + objectId };
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