// Follow a pledge by email: double opt-in, manage links, the daily alerts.
export { CONSENT_VERSION, PRIVACY_PATH, consentPoints } from "./consent";
export { TARGET_KINDS, isTargetKind, parseTarget, plainDescribe, sameTarget, type DescribeTarget, type Target, type TargetKind } from "./targets";
export { isEmail, isTokenShape, parseFollowRequest, type FollowRequest, type ParseResult } from "./input";
export {
  ADDRESS_DAILY_LIMIT,
  CONFIRM_TTL_DAYS,
  confirmEmailFollow,
  confirmUrl,
  confirmView,
  deleteByManageToken,
  linksFor,
  mailFooter,
  manageToken,
  manageUrl,
  manageView,
  maskEmail,
  privacyUrl,
  prunePendingAdditions,
  pruneUnconfirmed,
  removeTarget,
  requestEmailFollow,
  revokeManageLinks,
  unsubscribeUrl,
  type ConfirmResult,
  type ConfirmTokenState,
  type ConfirmView,
  type FollowContext,
  type ManageView,
  type RemoveResult,
} from "./service";
export { DELIVERY_KEEP_DAYS, runAlerts, type AlertItem, type AlertRun } from "./alerts";
