/*global define*/
/*jslint white:true,browser:true*/
define([
    'kb/common/html',
    'highlight',
    'numeral'
], function (html, highlight, numeral) {
    'use strict';

    function factory(config) {
        var runtime = config.runtime, container,
            t = html.tag,
            div = t('div');

        // from http://stackoverflow.com/questions/1248302/javascript-object-size


        function renderJson(object) {
            var jsString = JSON.stringify(object, true, 4), comment, t = html.tag,
                p = t('p'), pre = t('pre'), code = t('code'), div = t('div');
            if (jsString.length > 10000) {
                comment = p(['Object is too large to display fully (', numeral(jsString.length).format('0.0b'), ') truncated at 10K']);
                jsString = jsString.substr(0, 10000);
            }
            return div([
                comment,
                pre(code(highlight.highlight('json', jsString).value))
            ]);
        }

        function renderOverview(data) {
            return renderJson(data);
        }
        function renderProvenance(data) {
            return renderJson(data);
        }
        function renderObject(data) {
            return renderJson(data);
        }

        function attach(node) {
            container = node;
            container.innerHTML = div({class: 'container-fluid'}, [
                div({class: 'row'}, [
                    div({class: 'col-md-12'}, div({class: 'well'}, html.loading('Loading object...')))
                ])
            ]);

        }
        function start(params) {


            container.innerHTML = div({class: 'container-fluid'}, [
                div({class: 'row'}, [
                    div({class: 'col-md-12'}, [
                        html.makePanel({
                            title: 'Overview',
                            content: renderOverview(params.object.info)
                        }),
                        html.makePanel({
                            title: 'Provenance',
                            content: renderProvenance(params.object.provenance)
                        }),
                        html.makePanel({
                            title: 'Object',
                            content: renderObject(params.object.data)
                        })
                    ])
                ])
            ]);
        }

        return {
            attach: attach,
            start: start
        };
    }
    return {
        make: function (config) {
            return factory(config);
        }
    };
});