const webpack = require('webpack');
const path = require('path');
const fs = require('fs-extra');
const exec = require('child_process').execSync;

const version = exec('git describe --exact-match --tag HEAD 2>/dev/null || git rev-parse --short HEAD 2>/dev/null || echo unknown').toString().trim();
const license = fs.readFileSync('LICENSE', 'ascii');


module.exports = {
  target: 'node',
  entry: {
    'bundle': './src/index.js',
    'bundle.min': './src/index.js',
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist'),

    library: 'minidrone-js',
    libraryTarget: 'umd',
  },
  externals: {
    xml2js: 'xml2js',
    events: 'events',
    winston: 'winston',
    'case': 'case',
    noble: 'noble',
    'source-map-support': 'source-map-support',
    'get-installed-path': 'get-installed-path',
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /(node_modules|bower_components)/,
        include: /(src)/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['env'],
            cacheDirectory: true,
          },
        },
      },
      {
        test: /\.xml/,
        use: 'raw-loader',
      },
    ],
  },
  devtool: 'source-map',
  plugins: [
    new webpack.DefinePlugin({
      VERSION: JSON.stringify(version),
      LICENSE: JSON.stringify(license),
    }),

    new webpack.optimize.UglifyJsPlugin({
      include: /\.min\.js$/,
      minimize: true,
      sourceMap: false, // Useless because it's based on the bundle
      parallel: true,
    }),

    new webpack.BannerPlugin('hash:[hash], chunkhash:[chunkhash], name:[name], version:' + version),

    new webpack.BannerPlugin(license),
  ],
};
