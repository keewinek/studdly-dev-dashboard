/**
 * Screen catalog types + loader.
 *
 * Source of truth lives in Studdly:
 *   lib/ui_preview/ui_preview_catalog.dart
 * Export with:
 *   dart run tool/export_ui_preview_catalog.dart --out src/preview_catalog.json
 * (also run by sync-flutter-preview.sh / UI map CI)
 */

import catalogJson from './preview_catalog.json'

export type ScreenDef = {
  screenKey: string
  name: string
  route: string
  state: string
  group: string
  tags: string[]
}

type PreviewCatalogFile = {
  version: number
  generatedAt?: string
  source?: string
  screens: ScreenDef[]
}

const catalog = catalogJson as PreviewCatalogFile

/** Flat screen×state defs from Studdly's exported catalog. */
export function generateScreenDefs(): ScreenDef[] {
  if (!Array.isArray(catalog.screens) || catalog.screens.length === 0) {
    throw new Error(
      'src/preview_catalog.json is empty — run dart run tool/export_ui_preview_catalog.dart from Studdly',
    )
  }
  return catalog.screens
}

export const GENERATED_SCREEN_COUNT = generateScreenDefs().length
