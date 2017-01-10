/*global define*/
/*jslint white:true,browser:true*/
define([
    'kb_common/html',
    'kb_common/domEvent',
    'highlight',
    'numeral'
], function (html, domEvent, highlight, numeral) {
    'use strict';

    function factory(config) {
        var runtime = config.runtime, container,
            theObject, showLargeObject = false,
            events = domEvent.make(),
            t = html.tag,
            div = t('div'), button = t('button'),
            p = t('p'), pre = t('pre'), code = t('code'), div = t('div');

        function toggleLargeObject() {
            if (showLargeObject) {
                showLargeObject = false;
            } else {
                showLargeObject = true;
            }
            render();            
        }
        
        function renderOverview(data) {
            var jsString = JSON.stringify(data, true, 4), comment, formatOutput = true;
            return pre(code(highlight.highlight('json', jsString).value));
        }
        
        function renderProvenance(data) {
            var jsString = JSON.stringify(data, true, 4), comment, formatOutput = true;
            return pre(code(highlight.highlight('json', jsString).value));
        }
        
        function renderObject(data) {
            var jsString = JSON.stringify(data, true, 4), comment, formatOutput = true;

            if (jsString.length > 10000) {
                if (showLargeObject) {
                     comment = div([
                        p(['Object is very large (', numeral(jsString.length).format('0.0b'), '), but being displayed anyway.']),
                        p(['If the browser is misbehaving, refresh it or ',
                            button({
                                class: 'btn btn-default',
                                id: events.addEvent('click', toggleLargeObject)
                            }, 'Redisplay with the Object Truncated'),
                            '.'])
                    ]);
                    formatOutput = false;
                } else {
                    comment = div([
                        p(['Object is too large to display fully (', numeral(jsString.length).format('0.0b'), ') truncated at 10K.']),
                        p(['You may live dangerously and ',
                            button({
                                class: 'btn btn-default',
                                id: events.addEvent('click', toggleLargeObject)
                            }, 'Display the Entire Object Without Syntax Highlighting'),
                            '.'])
                    ]);
                    jsString = jsString.substr(0, 10000);
                }
            }
            return div([
                comment,                 
                pre(code( formatOutput ? highlight.highlight('json', jsString).value : jsString))
            ]);
        }

        function render() {
            events.detachEvents();
            container.innerHTML = div({class: 'container-fluid'}, [
                div({class: 'row'}, [
                    div({class: 'col-md-12'}, [
                        html.makePanel({
                            title: 'info',
                            content: renderOverview(theObject.info)
                        }),
                        html.makePanel({
                            title: 'provenance',
                            content: renderProvenance(theObject.provenance)
                        }),
                        html.makePanel({
                            title: 'data',
                            content: renderObject(theObject.data)
                        })
                    ])
                ])
            ]);
            events.attachEvents();
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
            theObject = params.object;
            render();
        }

        function detach() {
            events.detachEvents();
        }

        return {
            attach: attach,
            start: start,
            detach: detach
        };
    }
    return {
        make: function (config) {
            return factory(config);
        }
    };
});