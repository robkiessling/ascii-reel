const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpack = require('webpack');
const CopyPlugin = require("copy-webpack-plugin");

/**
 * Using mini-css-extract-plugin instead of style-loader for production builds (removes FOUC)
 * https://www.npmjs.com/package/style-loader#examples
 */
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

module.exports = (env, argv) => {
    const mode = argv.mode || "development";
    console.log("Running in mode:", mode);

    const prodMode = mode === "production";
    const analyzeBundle = env['analyze-bundle'] === 'true';

    const plugins = [
        new HtmlWebpackPlugin({
            hash: true,
            template: path.resolve(__dirname, 'src', 'index.html')
        }),

        new webpack.ProvidePlugin({
            $: "jquery",
            jQuery: "jquery"
        }),

        new CopyPlugin({
            patterns: [
                { from: path.resolve(__dirname, 'public'), to: path.resolve(__dirname, 'dist') }
            ],
        })
    ];

    if (analyzeBundle) {
        plugins.push(
            new (require("webpack-bundle-analyzer").BundleAnalyzerPlugin)({
                generateStatsFile: true
            })
        );
    }

    if (prodMode) {
        plugins.push(new MiniCssExtractPlugin());
    }

    return {
        entry: path.resolve(__dirname, 'src', 'js', 'index.js'),
        mode: mode,

        // Uncomment the following to help debug errors during the build process:
        // stats: { errorDetails: true },

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
        plugins: plugins,
        devServer: {
            static: {
                // Local filesystem directory where static html files are served
                directory: path.resolve(__dirname, 'public')
            },

            // I don't really like live reloading; prefer to reload myself
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
                    exclude: /node_modules/,
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
                    use: [
                        prodMode ? MiniCssExtractPlugin.loader : "style-loader",
                        'css-loader',
                        'postcss-loader', // postcss-loader must come before sass-loader
                        'sass-loader'
                    ]
                },
                {
                    test: /\.css$/,
                    use: [
                        prodMode ? MiniCssExtractPlugin.loader : "style-loader",
                        'css-loader',
                        'postcss-loader'
                    ]
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
    }
}