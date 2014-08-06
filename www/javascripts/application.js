/* global angular, Firebase */
"use strict";

var app = angular.module('Task', ['firebase'])

// constants for our Firebase URLs
app.constant('FBURL', 'https://todos-jirka.firebaseio.com/')
app.constant('USERS', 'https://todos-jirka.firebaseio.com/users')

// services to create our base Firebase references
app.service('Fb', ['FBURL', Firebase])
app.service('UserRef', ['USERS', Firebase])

// a factory for our $firebase instance
app.factory('Users', function(UserRef, $firebase) {
        return $firebase(UserRef);
    })

// Auth factory that encapsulates $firebaseSimpleLogin methods
// provides easy use of capturing events that were emitted
// on the $rootScope when users login and out
app.factory('Auth', function($firebaseSimpleLogin, Fb, $rootScope) {
        var simpleLogin = $firebaseSimpleLogin(Fb);
        return {
            getCurrentUser: function() {
                return simpleLogin.$getCurrentUser();
            },
            login: function(provider, user) {
                simpleLogin.$login(provider, {
                    email: user.email,
                    password: user.password
                });
            },
            logout: function() {
                simpleLogin.$logout();
            },
            register: function(user) {
                simpleLogin.$createUser({
                    email: user.email,
                    password: user.password
                }, function(error, user){
                        if (!error) {
                            console.log('User Id: ' + user.id + ', Email: ' + user.email);
                }});
            },
            onLogin: function(cb) {
                $rootScope.$on('$firebaseSimpleLogin:login',
                    function(e, user) {
                        cb(e, user);
                    });
            },
            onLogout: function(cb) {
                $rootScope.$on('$firebaseSimpleLogin:logout',
                    function(e, user) {
                        cb(e, user);
                    });
            }
        }
    })

// this will completely abstract angular fire from your controller
// while still keeping your data synced in the 'tasks' property
app.factory('TaskStore', function(Users) {

        var TaskStore = (function() {
            function TaskStore(user, path) {
                // our tasks that will we will sync
                this.tasks = [];

                // get the id of the current user, providing readonly
                // access to this value so it can't be modified
                this.getUid = function() {
                    return user.uid;
                };

                // easier way to get to the path by just joining
                // an array to the location
                this.pathPieces = [this.getUid(), 'tasks', path];
                this.getTaskPath = function() {
                    return this.pathPieces.join('/');
                };

                // get the reference we'll use
                this.getRef = function() {
                    var taskPath = this.getTaskPath();
                    return Users.$child(taskPath);
                };

                // this private function will take in the store object
                // so we have access to our methods. then it will create
                // a listener for children and add them to the tasks array
                // every time a task gets added
                function syncTasks(store) {
                    var taskPath = store.getTaskPath();
                    store.getRef().$on('child_added', function(data) {
                        store.tasks.push(data.snapshot); // we can just pass the snap back
                    });
                }

                // fire off the syncing
                syncTasks(this);

            }
            TaskStore.prototype = {
                add: function(task) {
                    this.getRef().$add({
                        title: task,
                        time: Firebase.ServerValue.TIMESTAMP
                    });
                },
                remove: function(task) {
                    var indexOf = this.tasks.indexOf(task);
                    if (indexOf !== -1) {
                        this.tasks.splice(indexOf, 1);
                        this.getRef().$remove(task.name);
                    }
                }
            };

            TaskStore.create = function(uid, path) {
                return new TaskStore(uid, path);
            };

            return TaskStore;
        }());

        return TaskStore;
    })

app.controller('TaskCtrl', function($scope, TaskStore, Auth) {

        $scope.login = function() {
            Auth.login('password', $scope.user);
        };

        $scope.logout = function() {
            Auth.logout();
        };

        $scope.register = function() {
            Auth.register($scope.user);
        };

        function loadUserTasks() {
            var incompleteStore, ENTER_KEY = 13;
            Auth.getCurrentUser().then(function(user) {
                if (!user) {
                    return;
                }
                // initialize our TaskStore, by passing in the path
                // we can reuse it for completed tasks as well
                incompleteStore = TaskStore.create(user, 'incomplete');
                $scope.tasks = incompleteStore.tasks;

                $scope.newTask = '';

                $scope.done = function(e, task) {
                    incompleteStore.remove(task);
                };

                $scope.add = function(e) {
                    // add on enter key
                    if (e.which && e.which === ENTER_KEY) {
                        incompleteStore.add($scope.newTask);
                        $scope.newTask = '';
                    }
                };

            });
        }

        // when a user has logged in load their tasks
        Auth.onLogin(function() {
            loadUserTasks();
        });

        // when a user has logged out empty the task array
        Auth.onLogout(function() {
            $scope.tasks = [];
        });

    });