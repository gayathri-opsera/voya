/**
 * Light theme — default theme for Voya.
 *
 * All values are PROVISIONAL. Marriott brand re-skinning is applied
 * by changing these token values only — no component rewrites required.
 *
 * Contrast compliance (WCAG 2.1 AA):
 *   color.text.primary (#09090b) on color.surface.page (#fafafa) ≈ 19.7:1  ✓
 *   color.interactive.accent (#b45309) on white (#ffffff) ≈ 4.98:1          ✓ (4.5:1 threshold)
 *   color.text.on-accent (#ffffff) on color.interactive.accent (#b45309) ≈ 4.98:1 ✓
 */

import type { SemanticTokenMap } from '../semantic/tokens.js';
import { NEUTRAL, BRAND, ACTION, DANGER, SUCCESS, WARNING } from '../primitives/colors.js';
import { FONT_SIZE, FONT_WEIGHT, LINE_HEIGHT, LETTER_SPACING, FONT_FAMILY } from '../primitives/typography.js';
import { SPACING } from '../primitives/spacing.js';
import { RADII } from '../primitives/radii.js';
import { ELEVATION } from '../primitives/elevation.js';
import { DURATION, EASING } from '../primitives/motion.js';

export const lightTheme: SemanticTokenMap = {
  // -- Color: text --
  'color.text.primary':    NEUTRAL['950'],
  'color.text.secondary':  NEUTRAL['600'],
  'color.text.tertiary':   NEUTRAL['500'],
  'color.text.disabled':   NEUTRAL['400'],
  'color.text.inverse':    NEUTRAL['white'],
  'color.text.on-accent':  NEUTRAL['white'],
  'color.text.link':       ACTION['700'],
  'color.text.link-hover': ACTION['900'],
  'color.text.danger':     DANGER['700'],
  'color.text.success':    SUCCESS['700'],
  'color.text.warning':    WARNING['700'],

  // -- Color: surface --
  'color.surface.page':     NEUTRAL['50'],
  'color.surface.card':     NEUTRAL['white'],
  'color.surface.overlay':  NEUTRAL['white'],
  'color.surface.sunken':   NEUTRAL['100'],
  'color.surface.elevated': NEUTRAL['white'],
  'color.surface.disabled': NEUTRAL['100'],

  // -- Color: border --
  'color.border.default': NEUTRAL['200'],
  'color.border.strong':  NEUTRAL['400'],
  'color.border.focus':   ACTION['600'],
  'color.border.danger':  DANGER['500'],
  'color.border.success': SUCCESS['500'],

  // -- Color: interactive --
  'color.interactive.accent':        BRAND['700'],   // #b45309 — ≈4.98:1 on white ✓
  'color.interactive.accent-hover':  BRAND['800'],
  'color.interactive.accent-active': BRAND['900'],
  'color.interactive.accent-subtle': BRAND['100'],
  'color.interactive.danger':        DANGER['600'],
  'color.interactive.danger-hover':  DANGER['700'],
  'color.interactive.success':       SUCCESS['600'],

  // -- Color: focus ring --
  'color.focus.ring':        ACTION['500'],
  'color.focus.ring-offset': NEUTRAL['white'],

  // -- Color: disabled state --
  'color.disabled.surface': NEUTRAL['100'],
  'color.disabled.text':    NEUTRAL['400'],
  'color.disabled.border':  NEUTRAL['200'],

  // -- Color: feedback states --
  'color.feedback.danger.surface':  DANGER['50'],
  'color.feedback.danger.border':   DANGER['400'],
  'color.feedback.danger.text':     DANGER['800'],
  'color.feedback.success.surface': SUCCESS['50'],
  'color.feedback.success.border':  SUCCESS['400'],
  'color.feedback.success.text':    SUCCESS['800'],
  'color.feedback.warning.surface': WARNING['50'],
  'color.feedback.warning.border':  WARNING['400'],
  'color.feedback.warning.text':    WARNING['800'],

  // -- Typography --
  'typography.size.xs':   FONT_SIZE['xs'],
  'typography.size.sm':   FONT_SIZE['sm'],
  'typography.size.base': FONT_SIZE['base'],
  'typography.size.lg':   FONT_SIZE['lg'],
  'typography.size.xl':   FONT_SIZE['xl'],
  'typography.size.2xl':  FONT_SIZE['2xl'],
  'typography.size.3xl':  FONT_SIZE['3xl'],
  'typography.size.4xl':  FONT_SIZE['4xl'],
  'typography.size.5xl':  FONT_SIZE['5xl'],
  'typography.weight.normal':   FONT_WEIGHT['normal'],
  'typography.weight.medium':   FONT_WEIGHT['medium'],
  'typography.weight.semibold': FONT_WEIGHT['semibold'],
  'typography.weight.bold':     FONT_WEIGHT['bold'],
  'typography.leading.tight':   LINE_HEIGHT['tight'],
  'typography.leading.snug':    LINE_HEIGHT['snug'],
  'typography.leading.normal':  LINE_HEIGHT['normal'],
  'typography.leading.relaxed': LINE_HEIGHT['relaxed'],
  'typography.tracking.normal': LETTER_SPACING['normal'],
  'typography.tracking.wide':   LETTER_SPACING['wide'],
  'typography.tracking.wider':  LETTER_SPACING['wider'],
  'typography.family.sans': FONT_FAMILY['sans'],
  'typography.family.mono': FONT_FAMILY['mono'],

  // -- Spacing --
  'space.0':   SPACING['0'],
  'space.0.5': SPACING['0.5'],
  'space.1':   SPACING['1'],
  'space.1.5': SPACING['1.5'],
  'space.2':   SPACING['2'],
  'space.2.5': SPACING['2.5'],
  'space.3':   SPACING['3'],
  'space.3.5': SPACING['3.5'],
  'space.4':   SPACING['4'],
  'space.5':   SPACING['5'],
  'space.6':   SPACING['6'],
  'space.7':   SPACING['7'],
  'space.8':   SPACING['8'],
  'space.9':   SPACING['9'],
  'space.10':  SPACING['10'],
  'space.11':  SPACING['11'],
  'space.12':  SPACING['12'],
  'space.14':  SPACING['14'],
  'space.16':  SPACING['16'],
  'space.20':  SPACING['20'],
  'space.24':  SPACING['24'],
  'space.28':  SPACING['28'],
  'space.32':  SPACING['32'],
  'space.36':  SPACING['36'],
  'space.40':  SPACING['40'],
  'space.48':  SPACING['48'],
  'space.56':  SPACING['56'],
  'space.64':  SPACING['64'],

  // -- Border radius --
  'radius.none':   RADII['none'],
  'radius.sm':     RADII['sm'],
  'radius.base':   RADII['base'],
  'radius.md':     RADII['md'],
  'radius.lg':     RADII['lg'],
  'radius.xl':     RADII['xl'],
  'radius.2xl':    RADII['2xl'],
  'radius.3xl':    RADII['3xl'],
  'radius.full':   RADII['full'],
  'radius.card':   RADII['xl'],
  'radius.button': RADII['md'],
  'radius.input':  RADII['md'],
  'radius.badge':  RADII['full'],
  'radius.modal':  RADII['2xl'],

  // -- Elevation --
  'elevation.none':     ELEVATION['none'],
  'elevation.sm':       ELEVATION['sm'],
  'elevation.base':     ELEVATION['base'],
  'elevation.md':       ELEVATION['md'],
  'elevation.lg':       ELEVATION['lg'],
  'elevation.xl':       ELEVATION['xl'],
  'elevation.2xl':      ELEVATION['2xl'],
  'elevation.card':     ELEVATION['md'],
  'elevation.modal':    ELEVATION['xl'],
  'elevation.dropdown': ELEVATION['lg'],

  // -- Motion --
  'motion.duration.instant': DURATION['instant'],
  'motion.duration.fast':    DURATION['fast'],
  'motion.duration.normal':  DURATION['normal'],
  'motion.duration.slow':    DURATION['slow'],
  'motion.duration.slower':  DURATION['slower'],
  'motion.easing.linear':      EASING['linear'],
  'motion.easing.ease-in':     EASING['ease-in'],
  'motion.easing.ease-out':    EASING['ease-out'],
  'motion.easing.ease-in-out': EASING['ease-in-out'],
  'motion.easing.spring':      EASING['spring'],
};
