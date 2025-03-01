// This library allows us to combine paths easily
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpack = require('webpack');
// const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

module.exports = {
    entry: path.resolve(__dirname, 'src', 'js', 'index.js'),
    mode: 'development',

    // Uncomment the following to help debug errors during the build process:
    // stats: {
    //     errorDetails: true
    // },

    // Uncomment the following to help debug javascript errors raised in production builds (after minification):
    // devtool: "source-map",

    // Doubling max sizes, since we almost go over the default 244KiB max with just jquery & jquery-ui alone
    performance: {
        maxEntrypointSize: 512000,
        maxAssetSize: 512000
    },

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
        }),

        // Uncomment the following to analyze bundle component sizes (run `npm run build` after uncommenting
        // and go to localhost:8888):
        // new BundleAnalyzerPlugin({
        //     generateStatsFile: true
        // })
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