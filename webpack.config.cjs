// This library allows us to combine paths easily
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpack = require('webpack');

module.exports = {
    entry: path.resolve(__dirname, 'src', 'js', 'index.js'),
    mode: 'development',

    // Uncomment the following to help debug build errors
    // stats: {
    //     errorDetails: true
    // },

    // Uncomment the following to help debug javascript errors in `/dist` builds:
    // devtool: "source-map",

    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'bundle.js',
        clean: true
    },
    plugins: [
        // Takes the src/index.html and builds it in dist
        new HtmlWebpackPlugin({
            hash: true,
            template: path.resolve(__dirname, 'src', 'index.html'),
            favicon: path.resolve(__dirname, 'public/favicon.png')
        }),
        new webpack.ProvidePlugin({
            $: "jquery",
            jQuery: "jquery"
        })
    ],
    devServer: {
        static: {
            // Local filesystem directory where static html files are served
            directory: path.resolve(__dirname, 'public')
        },

        // Don't really like live reloading; prefer to reload myself
        hot: false,
        liveReload: false
    },
    resolve: {
        extensions: ['.js']
    },
    module: {
        rules: [
            {
                test: /\.js/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: [
                            [
                                "@babel/preset-env",
                                {
                                    // The following is needed for clipboard cut/paste https://stackoverflow.com/a/61517521
                                    "useBuiltIns": "entry",
                                    "corejs": 3,
                                    "targets": "> 0.25%, not dead"
                                }
                            ]
                        ]
                    }
                }
            },
            {
                test: /\.scss/,
                // Note that postcss loader must come before sass-loader
                use: ['style-loader', 'css-loader', 'postcss-loader', 'sass-loader']
            },
            {
                test: /\.css$/,
                use: [ 'style-loader', 'css-loader', 'postcss-loader' ]
            },
            {
                test: /\.(png|svg|jpg|jpeg|gif)$/i,
                type: 'asset/resource'
            },
            {
                test: /\.(woff|woff2|eot|ttf|otf)$/i,
                type: 'asset/resource',
            }
        ]
    }
};