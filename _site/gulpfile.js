var gulp = require('gulp');
var less = require('gulp-less');
var jshint = require('gulp-jshint');
var stylish = require('jshint-stylish');
var babel = require('gulp-babel');
var plumber = require('gulp-plumber');
var cp = require('child_process');
var util = require('util');
var beep = require('beepbeep');

gulp.task('styles', function () {
  return gulp.src('less/main.less')
    .pipe(plumber(function () {
      beep();
      console.error('Error compiling less.');
      this.emit('end');
    }))
    .pipe(less())
    .pipe(gulp.dest('_site/css'));
});

gulp.task('js', function () {
  return gulp.src(['js/**/*.js', '!js/vendor/**/*.js'])
    .pipe(plumber(function () {
      beep();
      console.error('Error compiling JS.');
      this.emit('end');
    }))
    .pipe(jshint())
    .pipe(jshint.reporter(stylish))
    .pipe(jshint.reporter('fail'))
    .pipe(babel({
      presets: ['es2015']
    }))
    .pipe(gulp.dest('_site/js'));
});

gulp.task('copy:js', function () {
  return gulp.src([
    'bower_components/jquery/dist/jquery.min.js',
    'bower_components/semantic/dist/semantic.min.js',
    'bower_components/requirejs/require.js',
    'js/vendor/**/*.js'
  ]).pipe(gulp.dest('_site/js'))
});

gulp.task('copy:fonts', function () {
  return gulp.src([
    'bower_components/semantic/dist/themes/default/**/*'
  ]).pipe(gulp.dest('_site/css/themes/default'));
});

gulp.task('copy', ['copy:js', 'copy:fonts']);

gulp.task('jekyll', ['build'], function () {
  var jekyll = cp.spawn('jekyll', ['serve', '--host=0.0.0.0', '--config=' + __dirname + '/_config.yml'], {stdio: 'inherit'})
    .on('error', (error) => {
      console.error(util.inspect(error));
      process.exit(1);
    })
    .on('close', console.log.bind(console));

  process.on('exit', () => {
    jekyll.stdin.pause();
    jekyll.kill();
  });

  return jekyll;
});

gulp.task('build', ['styles', 'js', 'copy']);
gulp.task('default', ['jekyll', 'watch']);

gulp.task('watch', function () {
  gulp.watch('js/*', ['js']);
  gulp.watch('less/*', ['styles']);
});
