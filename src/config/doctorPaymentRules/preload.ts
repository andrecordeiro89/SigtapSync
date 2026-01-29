import { loadGynHonMap } from './importers/gynXlsx'
import { loadUroHonMap } from './importers/uroXlsx'
import { loadUroJsonMap } from './importers/uroJson'
import { loadOtoHonMap } from './importers/otoXlsx'
import { loadOtoSaoJoseHonMap } from './importers/otoSaoJoseXlsx'
import { loadVasHonMap } from './importers/vasXlsx'

loadGynHonMap()
loadUroHonMap()
loadUroJsonMap()
loadOtoHonMap()
loadOtoSaoJoseHonMap()
loadVasHonMap()
