requirejs.config({
  baseUrl: 'js',
  paths: {
    jquery: 'jquery.min',
    semantic: 'semantic.min',
    webgl: 'webgl-debug'
  },
  shim: {
    semantic: {
      deps: ['jquery'],
      exports: '$'
    },
    webgl: {
      deps: [],
      exports: 'WebGLDebugUtils'
    }
  },
  map: {
    '*': {'jquery': 'semantic'},
    'semantic': {'jquery': 'jquery'}
  }
});

requirejs(['jquery', 'range', 'controls'], function main($, range, Controls) {
  'use strict';

  console.log('Initialising app...');
  $('.ui.checkbox').checkbox();

  new Controls($('#screen'), $('#controls'));
});
