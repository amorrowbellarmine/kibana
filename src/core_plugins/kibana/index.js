/*
 * Licensed to Elasticsearch B.V. under one or more contributor
 * license agreements. See the NOTICE file distributed with
 * this work for additional information regarding copyright
 * ownership. Elasticsearch B.V. licenses this file to you under
 * the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { resolve } from 'path';

import Promise from 'bluebird';
import { mkdirp as mkdirpNode } from 'mkdirp';

import manageUuid from './server/lib/manage_uuid';
import { searchApi } from './server/routes/api/search';
import { scrollSearchApi } from './server/routes/api/scroll_search';
import { importApi } from './server/routes/api/import';
import { exportApi } from './server/routes/api/export';
import { homeApi } from './server/routes/api/home';
import { managementApi } from './server/routes/api/management';
import { scriptsApi } from './server/routes/api/scripts';
import { registerSuggestionsApi } from './server/routes/api/suggestions';
import { registerFieldFormats } from './server/field_formats/register';
import { registerTutorials } from './server/tutorials/register';
import * as systemApi from './server/lib/system_api';
import handleEsError from './server/lib/handle_es_error';
import mappings from './mappings.json';
import { getUiSettingDefaults } from './ui_setting_defaults';

import { injectVars } from './inject_vars';

const mkdirp = Promise.promisify(mkdirpNode);

export default function (kibana) {
  const kbnBaseUrl = '/app/kibana';
  return new kibana.Plugin({
    id: 'kibana',
    config: function (Joi) {
      return Joi.object({
        enabled: Joi.boolean().default(true),
        defaultAppId: Joi.string().default('home'),
        index: Joi.string().default('.kibana')
      }).default();
    },

    uiExports: {
      hacks: ['plugins/kibana/dev_tools/hacks/hide_empty_tools'],
      fieldFormats: ['plugins/kibana/field_formats/register'],
      savedObjectTypes: [
        'plugins/kibana/visualize/saved_visualizations/saved_visualization_register',
        'plugins/kibana/discover/saved_searches/saved_search_register',
        'plugins/kibana/dashboard/saved_dashboard/saved_dashboard_register',
      ],
      app: {
        id: 'kibana',
        title: 'Kibana',
        listed: false,
        description: 'the kibana you know and love',
        main: 'plugins/kibana/kibana',
      },

      links: [
        {
          id: 'kibana:discover',
          title: 'Discover',
          order: -1003,
          url: `${kbnBaseUrl}#/discover`,
          description: 'interactively explore your data',
          icon: 'plugins/kibana/assets/discover.svg',
        }, {
          id: 'kibana:visualize',
          title: 'Visualize',
          order: -1002,
          url: `${kbnBaseUrl}#/visualize`,
          description: 'design data visualizations',
          icon: 'plugins/kibana/assets/visualize.svg',
        }, {
          id: 'kibana:dashboard',
          title: 'Dashboard',
          order: -1001,
          url: `${kbnBaseUrl}#/dashboards`,
          // The subUrlBase is the common substring of all urls for this app. If not given, it defaults to the url
          // above. This app has to use a different subUrlBase, in addition to the url above, because "#/dashboard"
          // routes to a page that creates a new dashboard. When we introduced a landing page, we needed to change
          // the url above in order to preserve the original url for BWC. The subUrlBase helps the Chrome api nav
          // to determine what url to use for the app link.
          subUrlBase: `${kbnBaseUrl}#/dashboard`,
          description: 'compose visualizations for much win',
          icon: 'plugins/kibana/assets/dashboard.svg',
        }, {
          id: 'kibana:dev_tools',
          title: 'Dev Tools',
          order: 9001,
          url: '/app/kibana#/dev_tools',
          description: 'development tools',
          icon: 'plugins/kibana/assets/wrench.svg'
        }, {
          id: 'kibana:management',
          title: 'Management',
          order: 9003,
          url: `${kbnBaseUrl}#/management`,
          description: 'define index patterns, change config, and more',
          icon: 'plugins/kibana/assets/settings.svg',
          linkToLastSubUrl: false
        },
      ],

      injectDefaultVars(server, options) {
        return {
          kbnIndex: options.index,
          kbnBaseUrl
        };
      },

      translations: [
        resolve(__dirname, './translations/en.json')
      ],

      mappings,
      uiSettingDefaults: getUiSettingDefaults(),
    },

    preInit: async function (server) {
      try {
        // Create the data directory (recursively, if the a parent dir doesn't exist).
        // If it already exists, does nothing.
        await mkdirp(server.config().get('path.data'));
      } catch (err) {
        server.log(['error', 'init'], err);
        // Stop the server startup with a fatal error
        throw err;
      }
    },

    init: function (server) {
      // uuid
      manageUuid(server);
      // routes
      searchApi(server);
      scriptsApi(server);
      scrollSearchApi(server);
      importApi(server);
      exportApi(server);
      homeApi(server);
      managementApi(server);
      registerSuggestionsApi(server);
      registerFieldFormats(server);
      registerTutorials(server);
      server.expose('systemApi', systemApi);
      server.expose('handleEsError', handleEsError);
      server.injectUiAppVars('kibana', () => injectVars(server));
    }
  });
}