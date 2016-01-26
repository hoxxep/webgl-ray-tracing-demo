define(['jquery', 'semantic', 'raytracer'], function controls($, ui, RayTracer) {
  'use strict';

  class Controls {
    /**
     * Controller which hooks the controls into the RayTracer, and starts the tracer
     * @param $screen
     * @param $controls
     */
    constructor($screen, $controls) {
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
    profile() {
      var dimmer = this.$controls.children('.profiling.dimmer');
      dimmer.addClass('active');
      setTimeout(() => dimmer.removeClass('active'), 2000);
    }

    /**
     * Handle Render button press and render the scene once.
     * TODO: play/pause functionality?
     */
    render() {
      if (!this.interval) {
        this.$controls.find('button.render').html('Pause <i class="pause icon"></i>');

        var $time = this.$controls.find('span.render-time');
        this.$screen.children('.loaded.dimmer').removeClass('active');

        setTimeout(() => {
          try {
            this.interval = true;
            var startTime, endTime;
            startTime = endTime = new Date().getTime();
            var step = () => {
              if (this.interval) {
                startTime = new Date().getTime();
                this.simulationTime += (startTime - endTime)/100;
                this.rayTracer.render(this.setting('spheres'), this.setting('reflections'), this.setting('zoom'), this.checkbox('shadows'), this.simulationTime);
                endTime = new Date().getTime();
                $time.html(endTime - startTime + 'ms');
                requestAnimationFrame(step);
              }
            };
            requestAnimationFrame(step);
          } catch (error) {
            console.error(error);
            this.$screen.children('.error.dimmer')
              .addClass('active')
              .find('p').html(error.message);
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
    setting(name) {
      return this.$controls.find('.' + name + '.setting').val();
    }

    /**
     * Get the checkbox value of something
     * @param name
     * @returns {Boolean}
     */
    checkbox(name) {
      return !!this.$controls.find('.' + name + '.setting').checkbox('is checked');
    }
  }

  return Controls;
});
