define(['jquery'], function range($) {
  'use strict';

  /**
   * Show the text value for our HTML range elements in the label
   * @param e
   */
  function showValue(e) {
    var element = $(e.target);
    var parent = element.parent();
    parent.children('.value').html(element.val());
  }

  var ranges = $('input[type="range"]');

  ranges.on('change', showValue);
  ranges.on('input', showValue);
  $.each(ranges, (index, element) => showValue({target: element}));
});
