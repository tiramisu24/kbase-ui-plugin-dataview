/*global define*/
/*jslint white:true,browser:true*/
define([
    'bluebird'
], function (Promise) {
    'use strict';

    function factory(config) {
        var tasks = {},
            currentTimer,
            interval = config.interval || 5000,
            lastId = 0;

        function nextId() {
            lastId += 1;
            return lastId;
        }

        function addTask(task) {
            var id = String(nextId());
            tasks[id] = {
                started: (new Date()).getTime(),
                timeout: task.timeout,
                task: task,
                status: 'new'
            };
            ensureRunning();
        }

        function removeTask(id) {
            delete tasks[id];
        }

        function cancelTask(id) {
            var task = tasks[id];
            if (task.task.onCancel) {
                try {
                    task.task.onCancel();
                } catch (ex) {
                    // NB need a way to signal this error.
                    console.error('ERROR cancelling task', ex);
                }
            }
        }

        function cancelAllTasks() {
            Object.keys(tasks).forEach(function (id) {
                cancelTask(id);
            });
        }

        function ensureRunning() {
            if (currentTimer) {
                return;
            }
            currentTimer = window.setTimeout(function () {
                currentTimer = null;
                processTasks()
                    .then(function (doContinue) {
                        if (doContinue) {
                            ensureRunning();
                        }
                    });
            }, interval);
        }

        function processTasks() {
            return runTasks(tasks)
                .then(function (newTasks) {
                    tasks = newTasks;
                    if (tasks.length === 0) {
                        return false;
                    }
                    return true;
                });
        }

        function runTasks() {
            var ids = Object.keys(tasks);
            return Promise.all(ids.map(function (id) {
                    var task = tasks[id],
                        now = (new Date()).getTime(),
                        elapsed = now - task.started;
                    return Promise.try(function () {
                        return Promise.all([task, Promise.resolve(task.task.isCompleted(elapsed)).reflect()]);
                    });
                }))
                .then(function (results) {
                    return Promise.all(results.map(function (result) {
                        var task = result[0],
                            isCompleted = result[1],
                            now = (new Date()).getTime(),
                            elapsed = now - task.started;
                        if (isCompleted.isFulfilled()) {
                            var value = isCompleted.value();
                            // value being true if isComplted is happy that
                            // the task is completed.
                            if (value) {
                                task.status = 'completed';
                                return Promise.all([task, Promise.resolve(task.task.whenCompleted()).reflect()]);
                            }

                            if (elapsed > task.timeout) {
                                task.status = 'timedout';
                                return Promise.all([task, Promise.resolve(task.task.whenTimedOut(elapsed))]);
                            }

                            task.status = 'notready';
                            return Promise.all([task, false]);
                            // otherwise just wait...
                        }
                        task.status = 'error';
                        return Promise.all([task, Promise.resolve(task.task.whenError(isCompleted.reason())).reflect()]);
                    }));
                })
                .then(function (results) {
                    var newTasks = results.filter(function (result) {
                        var task = result[0];
                        if (task.status === 'completed') {
                            return false;
                        }
                        if (task.status === 'error') {
                            return false;
                        }
                        if (task.status === 'timedout') {
                            return false;
                        }
                        return true;
                    });
                    tasks = newTasks.map(function (task) {
                        return task[0];
                    });
                    return tasks;
                })
                .catch(function (err) {
                    console.error('ERROR in task runner');
                    console.error(err);
                });
        }

        return {
            addTask: addTask,
            removeTask: removeTask,
            cancelAllTasks: cancelAllTasks
        };
    }

    return {
        make: function (config) {
            return factory(config);
        }
    };
});