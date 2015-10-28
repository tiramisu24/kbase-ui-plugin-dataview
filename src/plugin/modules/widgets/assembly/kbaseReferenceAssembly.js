/*global define */
/*jslint white: true */
/**
 * Output widget to vizualize KBaseAssembly.ReferenceAssembly object.
 *
 * Pavel Novichkov <psnovichkov@lbl.gov>
 * @public
 */

define([
    'jquery',
    'kb_dataview_assembly_singleObjectBasic'
],
    function ($) {
        'use strict';

        $.KBWidget({
            name: 'kbaseReferenceAssembly',
            parent: 'kbaseSingleObjectBasicWidget',
            version: '1.0.1',
            getDataModel: function (objData) {
                var model = {
                    description: "This data object is a reference to a reference assembly that can be used when assembling reads",
                    items: []
                };

                if (objData.reference_name)
                    model.items.push({name: 'Reference name', value: objData.reference_name});
                if (objData.handle)
                    model.items.push({name: 'Source file name', value: objData.handle.file_name});
                return model;
            }
        });
    });




