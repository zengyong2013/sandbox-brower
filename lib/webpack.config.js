// const HtmlWebpackPlugin = require('html-webpack-plugin');
const path = require('path');

module.exports = {
  entry: './index.js',
  // target: 'electron-renderer',
  // mode: 'development',
  devtool: 'cheap-source-map',
  output: {
    filename: 'index.js',
    path: path.resolve(__dirname, './dist'),
  },
  // plugins: [
  //   new HtmlWebpackPlugin({
  //     template: 'src/render/index.html',
  //   })
  // ],
};
