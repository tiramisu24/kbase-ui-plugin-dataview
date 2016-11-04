/*global
 define
 */
/*jslint
 browser: true,
 white: true
 */
/**
 * Shows general gene info.
 * Such as its name, synonyms, annotation, publications, etc.
 *
 * Gene "instance" info (e.g. coordinates on a particular strain's genome)
 * is in a different widget.
 */
define([
    'jquery',
    'kb/common/html',
    'numeral',
    'kb/widget/legacy/widget'
], function ($, html, numeral) {
    'use strict';
    $.KBWidget({
        name: "KBaseGenomeOverview",
        parent: "kbaseWidget",
        version: "1.0.0",
        options: {
            genomeID: null,
            workspaceID: null,
            isInCard: false,
            genomeInfo: null
        },
        $infoTable: null,
        noContigs: "No Contigs",
        init: function (options) {
            this._super(options);

            this.$messagePane = $("<div/>").hide();
            this.$elem.append(this.$messagePane);

            this.render();
            return this;
        },
        render: function () {
            this.$infoPanel = $("<div>");

            this.$infoTable = $("<table>")
                .addClass("table table-striped table-bordered");
            this.$infoPanel.append($("<div>").css("overflow", "auto").append(this.$infoTable));

            this.$contigSelect = $("<select>")
                .addClass("form-control")
                .css({"width": "60%", "margin-right": "5px"})
                .append($("<option>")
                    .attr("id", this.noContigs)
                    .append(this.noContigs));

            this.$infoPanel.hide();
            this.$elem.append(this.$infoPanel);
            this.renderWorkspace();
        },
        addInfoRow: function (a, b) {
            return "<tr><th>" + a + "</th><td>" + b + "</td></tr>";
        },
        populateContigSelector: function (contigsToLengths) {
            this.$contigSelect.empty();
            if (!contigsToLengths || contigsToLengths.length === 0) {
                this.$contigSelect.append($("<option>")
                    .attr("id", this.noContigs)
                    .append(this.noContigs));
            }
            for (var contig in contigsToLengths) {
                this.$contigSelect.append($("<option>")
                    .attr("id", contig)
                    .append(contig + " - " + contigsToLengths[contig] + " bp"));
            }
        },
        alreadyRenderedTable: false,
        renderWorkspace: function () {
            var self = this;
            this.showMessage(html.loading('loading...'));
            this.$infoPanel.hide();

            try {
                self.showData(self.options.genomeInfo.data, self.options.genomeInfo.info[10]);
            }
            catch (e) {
                self.showError(e);
            }
            /*
            else {
                var obj = this.buildObjectIdentity(this.options.workspaceID, this.options.genomeID),
                    workspace = new Workspace(this.runtime.getConfig('services.workspace.url'), {
                    token: this.runtime.service('session').getAuthToken()
                });
                workspace.get_objects([obj])
                    .then(function (data) {
                        self.showData(data[0].data);
                    })
                    .catch(function (err) {
                        self.renderError(err);
                    });
            }
            */
        },
        showData: function (genome, metadata) {
            var self = this,
                gcContent = "Unknown",
                dnaLength = "Unknown",
                nFeatures = 0,
                num_contigs = 0,
                contigsToLengths = {},
                isInt = function (n) {
                    return typeof n === 'number' && n % 1 === 0;
                };

            self.pubmedQuery = genome.scientific_name;

            /** Changes - wjriehl 22apr2016 */
            /* Assume two cases for GC content.
             * 1. GC > 1 --> it's a raw percentage, so just render
             * 2. GC < 1 --> it's a decimal and should be x100
             * 3. (maybe?) GC > 100 --> it's an actual count of GCs and should be divided by dna length
             */
            
            if (genome.gc_content) {
                gcContent = Number(genome.gc_content);
                if (gcContent < 1.0)
                    gcContent = (gcContent * 100).toFixed(2) + " %";
                else if (gcContent > 100) {
                    if (genome.dna_size && genome.dna_size !== 0) {
                        gcContent = gcContent + Number(genome.dna_size) + " %";
                    }
                }
                else {
                    gcContent = gcContent.toFixed(2) + " %";
                }
            }

            if (genome.features) {
                nFeatures = genome.features.length;
            }
            else if (metadata && metadata["Number features"]) {
                nFeatures = metadata["Number features"];
            }

            if (genome.num_contigs) {
                num_contigs = genome.num_contigs;
            }
            else if (genome.contig_ids) {
                num_contigs = genome.contig_ids.length;
            }

            if (genome.dna_size) {
                dnaLength = genome.dna_size;
            }

            this.$infoTable.empty()
                .append(this.addInfoRow("Name", genome.scientific_name))
                .append(this.addInfoRow("KBase Genome ID", genome.id))
                .append(this.addInfoRow("Domain", genome.domain))
                .append(this.addInfoRow("DNA Length", numeral(dnaLength).format('0,0')))
                .append(this.addInfoRow("Source ID", genome.source + ": " + genome.source_id))
                .append(this.addInfoRow("Number of Contigs", numeral(num_contigs).format('0,0')))
                .append(this.addInfoRow("GC Content", gcContent))
                .append(this.addInfoRow("Genetic Code", genome.genetic_code))
                .append(this.addInfoRow("Number of features", numeral(nFeatures).format('0,0')));

            self.alreadyRenderedTable = true;

            this.hideMessage();
            this.$infoPanel.show();
        },
        getData: function () {
            return {
                type: "Genome",
                id: this.options.genomeID,
                workspace: this.options.workspaceID,
                title: "Genome Overview"
            };
        },
        showMessage: function (message) {
            // kbase panel now does this for us, should probably remove this
            var span = $("<span/>").append(message);

            this.$messagePane.empty()
                .append(span)
                .show();
        },
        hideMessage: function () {
            // kbase panel now does this for us, should probably remove this
            this.$messagePane.hide();

        },
        buildObjectIdentity: function (workspaceID, objectID) {
            var obj = {};
            if (/^\d+$/.exec(workspaceID))
                obj['wsid'] = workspaceID;
            else
                obj['workspace'] = workspaceID;

            // same for the id
            if (/^\d+$/.exec(objectID))
                obj['objid'] = objectID;
            else
                obj['name'] = objectID;
            return obj;
        },
        renderError: function (error) {
            errString = "Sorry, an unknown error occurred";
            if (typeof error === "string")
                errString = error;
            else if (error.error && error.error.message)
                errString = error.error.message;


            var $errorDiv = $("<div>")
                .addClass("alert alert-danger")
                .append("<b>Error:</b>")
                .append("<br>" + errString);
            this.$elem.empty();
            this.$elem.append($errorDiv);
        }
    });
});