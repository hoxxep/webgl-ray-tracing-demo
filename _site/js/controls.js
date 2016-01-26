'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

define(['jquery', 'semantic', 'raytracer'], function controls($, ui, RayTracer) {
  'use strict';

  var Controls = function () {
    /**
     * Controller which hooks the controls into the RayTracer, and starts the tracer
     * @param $screen
     * @param $controls
     */

    function Controls($screen, $controls) {
      _classCallCheck(this, Controls);

      this.$screen = $screen;
      this.$canvas = $screen.find('canvas.render');
      this.$controls = $controls;

      try {
        this.rayTracer = new RayTracer(this.$canvas);
      } catch (e) {
        this.$screen.children('.error.dimmer').addClass('active');
        throw e;
      } finally {
        this.$screen.children('.loading.dimmer').removeClass('active');
        this.$screen.children('.loaded.dimmer').addClass('active');
      }

      this.$controls.find('button.render').click(this.render.bind(this));
      this.$controls.find('button.profile').click(this.profile.bind(this));

      this.simulationTime = 0.0;
    }

    /**
     * Handle the Profile button press and run a profile on the performance
     */

    _createClass(Controls, [{
      key: 'profile',
      value: function profile() {
        var dimmer = this.$controls.children('.profiling.dimmer');
        dimmer.addClass('active');
        setTimeout(function () {
          return dimmer.removeClass('active');
        }, 2000);
      }

      /**
       * Handle Render button press and render the scene once.
       * TODO: play/pause functionality?
       */

    }, {
      key: 'render',
      value: function render() {
        var _this = this;

        if (!this.interval) {
          this.$controls.find('button.render').html('Pause <i class="pause icon"></i>');

          var $time = this.$controls.find('span.render-time');
          this.$screen.children('.loaded.dimmer').removeClass('active');

          setTimeout(function () {
            try {
              _this.interval = true;
              var startTime, endTime;
              startTime = endTime = new Date().getTime();
              var step = function step() {
                if (_this.interval) {
                  startTime = new Date().getTime();
                  _this.simulationTime += (startTime - endTime) / 100;
                  _this.rayTracer.render(_this.setting('spheres'), _this.setting('reflections'), _this.setting('zoom'), _this.checkbox('shadows'), _this.simulationTime);
                  endTime = new Date().getTime();
                  $time.html(endTime - startTime + 'ms');
                  requestAnimationFrame(step);
                }
              };
              requestAnimationFrame(step);
            } catch (error) {
              console.error(error);
              _this.$screen.children('.error.dimmer').addClass('active').find('p').html(error.message);
            }
          }, 1);
        } else {
          clearInterval(this.interval);
          this.interval = null;
          this.$controls.find('button.render').html('Render <i class="play icon"></i>');
        }
      }

      /**
       * Get the value of a setting
       * @param name
       * @returns {*}
       */

    }, {
      key: 'setting',
      value: function setting(name) {
        return this.$controls.find('.' + name + '.setting').val();
      }

      /**
       * Get the checkbox value of something
       * @param name
       * @returns {Boolean}
       */

    }, {
      key: 'checkbox',
      value: function checkbox(name) {
        return !!this.$controls.find('.' + name + '.setting').checkbox('is checked');
      }
    }]);

    return Controls;
  }();

  return Controls;
});