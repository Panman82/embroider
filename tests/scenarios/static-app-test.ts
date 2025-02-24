import { appScenarios } from './scenarios';
import { PreparedApp } from 'scenario-tester';
import QUnit from 'qunit';
import merge from 'lodash/merge';
const { module: Qmodule, test } = QUnit;

appScenarios
  .map('static-app', project => {
    project.linkDevDependency('bootstrap', { baseDir: __dirname });
    project.linkDevDependency('ember-bootstrap', { baseDir: __dirname });
    project.linkDevDependency('@embroider/macros', { baseDir: __dirname });
    project.linkDevDependency('ember-composable-helpers', { baseDir: __dirname });

    merge(project.files, {
      app: {
        components: {
          'fancy-box.js': `
            import Component from '@glimmer/component';

            export default class FancyBox extends Component {
              get titleComponentWithDefault() {
                return this.args.titleComponent || 'default-title';
              }
            }
          `,
        },
        helpers: {
          'loaded-components.js': `
            /* global requirejs */
            import { helper } from '@ember/component/helper';

            export function loadedComponents() {
              let result = new Set();
              for (let name of Object.keys(requirejs.entries)) {
                let m = /^[a-zA-Z0-9_-]+\\/components\\/(.*)/.exec(name);
                if (m) {
                  result.add(m[1]);
                }
                m = /^[a-zA-Z0-9_-]+\\/templates\\/components\\/(.*)/.exec(name);
                if (m) {
                  result.add(m[1]);
                }
              }
              return [...result];
            }

            export default helper(loadedComponents);
          `,
          'loaded-helpers.js': `
            /* global requirejs */
            import { helper } from '@ember/component/helper';

            export function loadedHelpers() {
              return Object.keys(requirejs.entries)
                .map(k => { let m = /^[a-zA-Z0-9_-]+\\/helpers\\/(.*)/.exec(k); if (m){ return m[1]}}).filter(Boolean).sort();
            }

            export default helper(loadedHelpers);
          `,
        },
        templates: {
          components: {
            'default-title.hbs': `
              <div data-example="default" class="the-default-title-component">{{@title}}</div>
            `,
            'fancy-box.hbs': `
              {{component this.titleComponentWithDefault title=@title}}
            `,
            'my-title.hbs': `
              <div data-example="customized" class="my-title-component">{{@title}}</div>
            `,
          },
          'components-example.hbs': `
            {{! this uses a component from ember-bootstrap }}
            <BsButton>Button</BsButton>

            {{! then this lists all the components loaded into our app.}}
            {{#each (loaded-components) as |name|}}
              <div data-component-name={{name}}>{{name}}</div>
            {{/each}}
          `,
          'helpers-example.hbs': `
            {{! this uses two helpers from ember-composable-helpers }}
            {{#each (reverse (array "alpha" "beta")) as |word| }}
              <div data-word={{word}}>{{word}}</div>
            {{/each}}

            {{! then this lists all the helpers loaded into our app. It should have the two
            above, but none of the other stuff from composable-helpers }}
            {{#each (loaded-helpers) as |name|}}
              <div data-helper-name={{name}}>{{name}}</div>
            {{/each}}
          `,
          'macros-example.hbs': `
            <h1 data-macro>Welcome to this {{#if (macroCondition (macroGetOwnConfig "isClassic"))}}classic{{else}}embroider{{/if}} app!</h1>
          `,
          'static-component-rules-example.hbs': `
            <FancyBox @title="With Default" />
            <FancyBox @title="With Custom" @titleComponent="my-title" />
          `,
        },
        'router.js': `
          import EmberRouter from '@ember/routing/router';
          import config from 'app-template/config/environment';

          export default class Router extends EmberRouter {
            location = config.locationType;
            rootURL = config.rootURL;
          }

          Router.map(function() {
            this.route('helpers-example');
            this.route('components-example');
            this.route('static-component-rules-example');
            this.route('macros-example');
          });
        `,
      },
      tests: {
        acceptance: {
          'components-example-test.js': `
            import { module, test } from 'qunit';
            import { visit } from '@ember/test-helpers';
            import { setupApplicationTest } from 'ember-qunit';
            import { getOwnConfig } from '@embroider/macros';

            module('Acceptance | components-example', function(hooks) {
              setupApplicationTest(hooks);

              test('static components', async function(assert) {
                await visit('/components-example');

                let button = document.querySelector('.btn');
                assert.ok(button, 'found ember-bootstrap button');
                if (button) {
                  assert.equal(getComputedStyle(button)['background-color'], "rgb(108, 117, 125)", "bs-button has its CSS");
                }

                let components = [...document.querySelectorAll("[data-component-name]")].map(elt => elt.dataset.componentName);
                assert.ok(components.includes('bs-button'), 'expected to find bs-button');

                if (getOwnConfig().isClassic) {
                  assert.ok(components.includes('bs-carousel'), 'expected to find bs-carousel in classic build');
                } else {
                  assert.ok(!components.includes('bs-carousel'), 'expected not to find bs-carousel in embroider build');
                }
              });
            });
          `,
          'helpers-example-test.js': `
            import { module, test } from 'qunit';
            import { visit } from '@ember/test-helpers';
            import { setupApplicationTest } from 'ember-qunit';
            import { getOwnConfig } from '@embroider/macros';

            module('Acceptance | helpers-example', function(hooks) {
              setupApplicationTest(hooks);

              test('static helpers', async function(assert) {
                await visit('/helpers-example');

                assert.deepEqual(
                  [...document.querySelectorAll("[data-word]")].map(elt => elt.dataset.word),
                  ['beta', 'alpha'],
                  'array and reverse worked'
                );

                let helpers = [...document.querySelectorAll("[data-helper-name]")].map(elt => elt.dataset.helperName);
                assert.ok(helpers.includes('reverse'), 'expected to find reverse');

                if (getOwnConfig().isClassic) {
                  assert.ok(helpers.includes('intersect'), 'expected to find intersect');
                } else {
                  assert.ok(!helpers.includes('intersect'), 'expected not to find intersect');
                }
              });
            });
          `,
          'macros-example-test.js': `
            import { module, test } from 'qunit';
            import { visit } from '@ember/test-helpers';
            import { setupApplicationTest } from 'ember-qunit';
            import { getOwnConfig } from '@embroider/macros';

            module('Acceptance | macros-example', function(hooks) {
              setupApplicationTest(hooks);

              test('macros work', async function(assert) {
                await visit('/macros-example');

                if (getOwnConfig().isClassic) {
                  assert.dom('[data-macro]').hasText('Welcome to this classic app!');
                } else {
                  assert.dom('[data-macro]').hasText('Welcome to this embroider app!');
                }
              });
            });
          `,
          'static-component-rules-example-test.js': `
            import { module, test } from 'qunit';
            import { visit, currentURL } from '@ember/test-helpers';
            import { setupApplicationTest } from 'ember-qunit';

            module('Acceptance | static component rules example', function(hooks) {
              setupApplicationTest(hooks);

              test('visiting /static-component-rules-example', async function(assert) {
                await visit('/static-component-rules-example');
                assert.equal(currentURL(), '/static-component-rules-example');
                assert.ok(document.querySelector('[data-example="default"].the-default-title-component'), 'default exists');
                assert.ok(document.querySelector('[data-example="customized"].my-title-component'), 'customized exists');
              });
            });
          `,
        },
        unit: {
          'missing-import-sync-renamed-test.js': `
            import { module, test } from 'qunit';
            import { importSync as i } from '@embroider/macros';

            module('Unit | missing modules referenced by i which was renamed from importSync', function() {
              test('it works', function(assert) {
                assert.expect(2);

                assert.throws(() => {
                  i('foobar');
                }, /Error: Could not find module \`foobar\`/);

                assert.throws(() => {
                  i('foobaz');
                }, /Error: Could not find module \`foobaz\`/);
              });
            });
          `,
          'missing-import-test.js': `
            import { module, test } from 'qunit';
            import { importSync } from '@embroider/macros';

            module('Unit | missing modules referenced by importSync', function() {
              test('it works', function(assert) {
                assert.expect(2);

                assert.throws(() => {
                  importSync('bar');
                }, /Error: Could not find module \`bar\`/);

                assert.throws(() => {
                  importSync('baz');
                }, /Error: Could not find module \`baz\`/);
              });
            });
          `,
        },
      },
      'ember-cli-build.js': `
        'use strict';

        const EmberApp = require('ember-cli/lib/broccoli/ember-app');
        const { MacrosConfig } = require('@embroider/macros/src/node');

        module.exports = function (defaults) {
          let app = new EmberApp(defaults, {
            'ember-bootstrap': {
              bootstrapVersion: 4,
              importBootstrapCSS: true
            }
          });

          MacrosConfig.for(app).setOwnConfig(__filename, {
            isClassic: Boolean(process.env.CLASSIC),
          });

          if (process.env.CLASSIC) {
            return app.toTree();
          }

          const Webpack = require('@embroider/webpack').Webpack;
          return require('@embroider/compat').compatBuild(app, Webpack, {
            workspaceDir: process.env.WORKSPACE_DIR,
            staticAddonTestSupportTrees: true,
            staticAddonTrees: true,
            staticComponents: true,
            staticHelpers: true,
            staticModifiers: true,
            packageRules: [
              {
                package: 'app-template',
                appModules: {
                  'components/fancy-box.js': {
                    dependsOnComponents: ['{{default-title}}'],
                  },
                },
                components: {
                  '{{fancy-box}}': {
                    acceptsComponentArguments: [{ name: 'titleComponent', becomes: 'this.titleComponentWithDefault' }],
                  },
                },
              },
            ],
            skipBabel: [
              { package: 'qunit' },
              { package: 'macro-decorators' },
            ],
          });
        };
      `,
    });
  })
  .forEachScenario(scenario => {
    Qmodule(scenario.name, function (hooks) {
      let app: PreparedApp;
      hooks.before(async () => {
        app = await scenario.prepare();
      });

      ['production', 'development'].forEach(env => {
        test(`yarn test: ${env}`, async function (assert) {
          let result = await app.execute(`cross-env EMBER_ENV=${env} yarn test`);
          assert.equal(result.exitCode, 0, result.output);
        });
      });
    });
  });
