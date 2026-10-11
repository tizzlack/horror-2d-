// The modules the night screen builds on, gathered in one place.
import { nightConfig } from '../../data/nights.js';
import { generateNight, prepareVisit } from '../../systems/visits.js';
import * as rules from '../../systems/rules.js';
import { createFigureView, createShadowView, createMirrorView } from '../../render/figure.js';
import * as effects from '../../render/effects.js';
import { icon } from '../../render/icons.js';
import { openAlbumOverlay } from '../album.js';
import { openSettingsOverlay } from '../settings.js';

export async function loadDeps() {
  return {
    used: [],
    nightConfig,
    generateNight,
    prepareVisit,
    rules,
    createFigureView,
    createShadowView,
    createMirrorView,
    effects,
    icon,
    openAlbumOverlay,
    openSettingsOverlay,
  };
}
