'use strict';

import Homey from 'homey';

module.exports = class JblSynthesisApp extends Homey.App {

  async onInit(): Promise<void> {
    this.log('JBL Synthesis app initialized');
  }

};
