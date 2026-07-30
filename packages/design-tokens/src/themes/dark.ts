/**
 * Dark theme — structural/provisional variant.
 *
 * PROVISIONAL: These values have not received Marriott brand approval.
 * This theme is provided as a structural scaffold only. All color decisions
 * must be revisited when official dark-mode brand guidelines are issued.
 *
 * Contrast compliance (WCAG 2.1 AA):
 *   color.text.primary (#fafafa) on color.surface.page (#09090b) ≈ 19.7:1  ✓
 *   color.interactive.accent (#f59e0b) on surface.page (#09090b) ≈ 9.67:1  ✓
 *   color.text.on-accent (#09090b) on color.interactive.accent (#f59e0b) ≈ 9.67:1 ✓
 */

import type { SemanticTokenMap } from '../semantic/tokens.js';
import { NEUTRAL, BRAND, ACTION, DANGER, SUCCESS, WARNING } from '../primitives/colors.js';
import { FONT_SIZE, FONT_WEIGHT, LINE_HEIGHT, LETTER_SPACING, FONT_FAMILY } from '../primitives/typography.js';
import { SPACING } from '../primitives/spacing.js';
import { RADII } from '../primitives/radii.js';
import { ELEVATION } from '../primitives/elevation.js';
import { DURATION, EASING } from '../primitives/motion.js';

export const darkTheme: SemanticTokenMap = {
  // -- Color: text --
  'color.text.primary':    NEUTRAL['50'],
  'color.text.secondary':  NEUTRAL['400'],
  'color.text.tertiary':   NEUTRAL['500'],
  'color.text.disabled':   NEUTRAL['600'],
  'color.text.inverse':    NEUTRAL['950'],
  'color.text.on-accent':  NEUTRAL['950'],
  'color.text.link':       ACTION['300'],
  'color.text.link-hover': ACTION['200'],
  'color.text.danger':     DANGER['400'],
  'color.text.success':    SUCCESS['400'],
  'color.text.warning':    WARNING['400'],

  // -- Color: surface --
  'color.surface.page':     NEUTRAL['950'],
  'color.surface.card':     NEUTRAL['900'],
  'color.surface.overlay':  NEUTRAL['800'],
  'color.surface.sunken':   '#000000',
  'color.surface.elevated': NEUTRAL['800'],
  'color.surface.disabled': NEUTRAL['800'],

  // -- Color: border --
  'color.border.default': NEUTRAL['700'],
  'color.border.strong':  NEUTRAL['600'],
  'color.border.focus':   ACTION['400'],
  'color.border.danger':  DANGER['500'],
  'color.border.success': SUCCESS['500'],

  // -- Color: interactive --
  'color.interactive.accent':        BRAND['500'],   // #f59e0b — ≈9.67:1 on #09090b ✓
  'color.interactive.accent-hover':  BRAND['400'],
  'color.interactive.accent-active': BRAND['300'],
  'color.interactive.accent-subtle': BRAND['950'],
  'color.interactive.danger':        DANGER['500'],
  'color.interactive.danger-hover':  DANGER['400'],
  'color.interactive.success':       SUCCESS['500'],

  // -- Color: focus ring --
  'color.focus.ring':        ACTION['400'],
  'color.focus.ring-offset': NEUTRAL['950'],

  // -- Color: disabled state --
  'color.disabled.surface': NEUTRAL['800'],
  'color.disabled.text':    NEUTRAL['600'],
  'color.disabled.border':  NEUTRAL['700'],

  // -- Color: feedback states --
  'color.feedback.danger.surface':  DANGER['800'],
  'color.feedback.danger.border':   DANGER['600'],
  'color.feedback.danger.text':     DANGER['100'],
  'color.feedback.success.surface': SUCCESS['800'],
  'color.feedback.success.border':  SUCCESS['600'],
  'color.feedback.success.text':    SUCCESS['100'],
  'color.feedback.warning.surface': WARNING['800'],
  'color.feedback.warning.border':  WARNING['600'],
  'color.feedback.warning.text':    WARNING['100'],

  // -- Typography (same as light; only color tokens differ by theme) --
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

  // -- Elevation (adjusted alpha for dark backgrounds) --
  'elevation.none':     ELEVATION['none'],
  'elevation.sm':       '0 1px 2px 0 rgb(0 0 0 / 0.20)',
  'elevation.base':     '0 1px 3px 0 rgb(0 0 0 / 0.30), 0 1px 2px -1px rgb(0 0 0 / 0.30)',
  'elevation.md':       '0 4px 6px -1px rgb(0 0 0 / 0.30), 0 2px 4px -2px rgb(0 0 0 / 0.30)',
  'elevation.lg':       '0 10px 15px -3px rgb(0 0 0 / 0.40), 0 4px 6px -4px rgb(0 0 0 / 0.40)',
  'elevation.xl':       '0 20px 25px -5px rgb(0 0 0 / 0.40), 0 8px 10px -6px rgb(0 0 0 / 0.40)',
  'elevation.2xl':      '0 25px 50px -12px rgb(0 0 0 / 0.60)',
  'elevation.card':     '0 4px 6px -1px rgb(0 0 0 / 0.30), 0 2px 4px -2px rgb(0 0 0 / 0.30)',
  'elevation.modal':    '0 20px 25px -5px rgb(0 0 0 / 0.40), 0 8px 10px -6px rgb(0 0 0 / 0.40)',
  'elevation.dropdown': '0 10px 15px -3px rgb(0 0 0 / 0.40), 0 4px 6px -4px rgb(0 0 0 / 0.40)',

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
