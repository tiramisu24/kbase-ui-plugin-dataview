/*global define*/
/*jslint white:true,browser:true*/
define([
    'kb_common/html',
    'highlight',
    'numeral'
], function (html, highlight, numeral) {
    'use strict';

    function objectRef(object) {
        return [object.info[6], object.info[0], object.info[4]].join('/');
    }

    function factory(config) {
        var runtime = config.runtime, container,
            t = html.tag,
            div = t('div'), table = t('table'), tr = t('tr'), td = t('td'), a = t('a');

        function renderOverview(object) {
            var ref = objectRef(object);
            return table({class: 'table table-striped'}, [
                tr([
                    td('Dataview'), td(a({href: '#dataview/' + ref}, ref))
                ])
            ]);
        }

        function attach(node) {
            container = node;
            container.innerHTML = div({class: 'well'}, html.loading('Loading object overview...'));

        }
        function start(params) {
            container.innerHTML = div({class: 'well'},renderOverview(params.object));
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