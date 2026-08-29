#!/bin/bash
set -euo pipefail

apple_root="$(cd "$(dirname "$0")/.." && pwd)"
archive_path=""
ipa_path=""
shipping=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --archive)
      [[ $# -ge 2 ]] || { echo "ERROR: --archive requires a path" >&2; exit 2; }
      archive_path="$2"
      shift 2
      ;;
    --ipa)
      [[ $# -ge 2 ]] || { echo "ERROR: --ipa requires a path" >&2; exit 2; }
      ipa_path="$2"
      shift 2
      ;;
    --shipping)
      shipping=true
      shift
      ;;
    *)
      echo "ERROR: unknown option: $1" >&2
      exit 2
      ;;
  esac
done

pass() { echo "PASS: $1"; }
fail() { echo "FAIL: $1" >&2; exit 1; }

for command_name in xcodegen xcodebuild plutil sips rg jq unzip codesign security; do
  command -v "$command_name" >/dev/null || fail "missing command: $command_name"
done

cd "$apple_root"

plutil -lint ThePickleHub/App/Info.plist >/dev/null
plutil -lint ThePickleHub/App/PrivacyInfo.xcprivacy >/dev/null
plutil -lint ThePickleHub/App/ThePickleHub.entitlements >/dev/null
jq empty Config/Package.resolved
pass "source plists and package lock are valid"

plutil -extract 'UISupportedInterfaceOrientations~ipad' json -o - ThePickleHub/App/Info.plist \
  | jq -e 'length == 4 and index("UIInterfaceOrientationPortrait") != null and index("UIInterfaceOrientationPortraitUpsideDown") != null and index("UIInterfaceOrientationLandscapeLeft") != null and index("UIInterfaceOrientationLandscapeRight") != null' >/dev/null \
  || fail "iPad must preserve all four interface orientations for multitasking"
pass "iPad declares all multitasking orientations"

for domain_name in "applinks:thepicklehub.net" "applinks:www.thepicklehub.net"; do
  /usr/libexec/PlistBuddy -c 'Print :com.apple.developer.associated-domains' \
    ThePickleHub/App/ThePickleHub.entitlements | rg -F "$domain_name" >/dev/null || fail "missing associated domain: $domain_name"
done
pass "universal-link entitlements cover both production hosts"

apple_signin_template="$(/usr/libexec/PlistBuddy -c 'Print :com.apple.developer.applesignin' \
  ThePickleHub/App/ThePickleHub.entitlements)"
rg -F "Default" <<< "$apple_signin_template" >/dev/null \
  || fail "Sign in with Apple entitlement must contain Default"
pass "Sign in with Apple entitlement is present"

aps_template="$(/usr/libexec/PlistBuddy -c 'Print :aps-environment' \
  ThePickleHub/App/ThePickleHub.entitlements)"
[[ "$aps_template" == '$(APS_ENVIRONMENT)' ]] || fail "push entitlement must be driven by APS_ENVIRONMENT"
pass "APNs entitlement is configuration-specific"

if rg -n '^[[:space:]]*(SUPABASE_SERVICE_ROLE|SERVICE_ROLE_KEY|FCM_SERVICE_ACCOUNT_JSON)[[:space:]]*=' \
  Config ThePickleHub project.yml >/dev/null; then
  fail "server credential material must never ship in the iOS client"
fi
pass "no server credential assignment in the native client"

icon_path="ThePickleHub/Resources/Assets.xcassets/AppIcon.appiconset/icon-1024.png"
[[ -f "$icon_path" ]] || fail "missing primary 1024x1024 App Store icon"
icon_width="$(sips -g pixelWidth "$icon_path" 2>/dev/null | awk '/pixelWidth/{print $2}')"
icon_height="$(sips -g pixelHeight "$icon_path" 2>/dev/null | awk '/pixelHeight/{print $2}')"
[[ "$icon_width" == "1024" && "$icon_height" == "1024" ]] || fail "primary App Store icon is not 1024x1024"
pass "primary App Store icon is 1024x1024"

xcodegen generate >/dev/null
resolved_dir="ThePickleHub.xcodeproj/project.xcworkspace/xcshareddata/swiftpm"
mkdir -p "$resolved_dir"
cp Config/Package.resolved "$resolved_dir/Package.resolved"

release_settings="$(xcodebuild \
  -project ThePickleHub.xcodeproj \
  -scheme ThePickleHub \
  -configuration Release \
  -destination 'generic/platform=iOS Simulator' \
  -showBuildSettings 2>/dev/null)"

debug_settings="$(xcodebuild \
  -project ThePickleHub.xcodeproj \
  -scheme ThePickleHub \
  -configuration Debug \
  -destination 'generic/platform=iOS Simulator' \
  -showBuildSettings 2>/dev/null)"

setting_from() {
  local settings_text="$1"
  local name="$2"
  awk -F ' = ' -v key="$name" '$1 ~ "^[[:space:]]*" key "$" {print $2}' <<< "$settings_text" | tail -n 1
}

bundle_id="$(setting_from "$release_settings" PRODUCT_BUNDLE_IDENTIFIER)"
marketing_version="$(setting_from "$release_settings" MARKETING_VERSION)"
build_number="$(setting_from "$release_settings" CURRENT_PROJECT_VERSION)"
environment_name="$(setting_from "$release_settings" APP_ENVIRONMENT)"
activation_flag="$(setting_from "$release_settings" NATIVE_EVENT_REGISTRATION_ENABLED)"
remote_push_flag="$(setting_from "$release_settings" REMOTE_PUSH_ENABLED)"
shop_built_in_flag="$(setting_from "$release_settings" SHOP_NATIVE_BUILT_IN)"
shop_pilot_flag="$(setting_from "$release_settings" SHOP_NATIVE_PILOT_ENABLED)"
auth_reset_approval="$(setting_from "$release_settings" CAPACITOR_AUTH_RESET_APPROVED)"
aps_environment="$(setting_from "$release_settings" APS_ENVIRONMENT)"
turnstile_key="$(setting_from "$release_settings" TURNSTILE_SITE_KEY)"
supabase_ref="$(setting_from "$release_settings" SUPABASE_PROJECT_REF)"
supabase_anon_key="$(setting_from "$release_settings" SUPABASE_ANON_KEY)"
firebase_google_app_id="$(setting_from "$release_settings" FIREBASE_GOOGLE_APP_ID)"
firebase_sender_id="$(setting_from "$release_settings" FIREBASE_GCM_SENDER_ID)"
firebase_api_key="$(setting_from "$release_settings" FIREBASE_API_KEY)"
firebase_project_id="$(setting_from "$release_settings" FIREBASE_PROJECT_ID)"
swift_version="$(setting_from "$release_settings" SWIFT_VERSION)"
targeted_device_family="$(setting_from "$release_settings" TARGETED_DEVICE_FAMILY)"

debug_bundle_id="$(setting_from "$debug_settings" PRODUCT_BUNDLE_IDENTIFIER)"
debug_version="$(setting_from "$debug_settings" MARKETING_VERSION)"
debug_build="$(setting_from "$debug_settings" CURRENT_PROJECT_VERSION)"
debug_environment="$(setting_from "$debug_settings" APP_ENVIRONMENT)"
debug_aps_environment="$(setting_from "$debug_settings" APS_ENVIRONMENT)"
debug_remote_push_flag="$(setting_from "$debug_settings" REMOTE_PUSH_ENABLED)"
debug_shop_built_in_flag="$(setting_from "$debug_settings" SHOP_NATIVE_BUILT_IN)"
debug_shop_pilot_flag="$(setting_from "$debug_settings" SHOP_NATIVE_PILOT_ENABLED)"

version_at_least() {
  local actual="$1"
  local minimum="$2"
  awk -v actual="$actual" -v minimum="$minimum" 'BEGIN {
    split(actual, a, "."); split(minimum, m, ".")
    for (i = 1; i <= 3; i++) {
      if ((a[i] + 0) > (m[i] + 0)) exit 0
      if ((a[i] + 0) < (m[i] + 0)) exit 1
    }
    exit 0
  }'
}

[[ "$bundle_id" == "net.thepicklehub.app" ]] || fail "Release bundle must replace the live app: net.thepicklehub.app"
[[ "$marketing_version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || fail "Release marketing version must use semantic numeric form"
version_at_least "$marketing_version" "1.1.0" || fail "Release marketing version must be at least 1.1.0"
[[ "$build_number" =~ ^[0-9]+$ && "$build_number" -ge 3 ]] || fail "Release build number must be numeric and at least 3"
[[ "$environment_name" == "production" ]] || fail "Release APP_ENVIRONMENT must be production"
[[ "$aps_environment" == "production" ]] || fail "Release APS_ENVIRONMENT must be production"
[[ "$swift_version" == "6.0" ]] || fail "Release target must compile in Swift 6 language mode"
[[ "$targeted_device_family" == "1,2" ]] || fail "Release target must preserve iPhone and iPad support"
pass "Release identity is $bundle_id $marketing_version ($build_number)"
pass "Release target uses Swift $swift_version language mode"
pass "Release target preserves iPhone and iPad device families"

[[ "$debug_bundle_id" == "$bundle_id" ]] || fail "Debug bundle must match Release for Sign in with Apple audience parity"
[[ "$debug_environment" == "development" ]] || fail "Debug APP_ENVIRONMENT must be development"
[[ "$debug_aps_environment" == "development" ]] || fail "Debug APS_ENVIRONMENT must be development"
[[ "$debug_version" == "$marketing_version" && "$debug_build" == "$build_number" ]] || fail "Debug and Release version/build values have drifted"
pass "Debug identity matches Release for Sign in with Apple at $debug_bundle_id"

activation_normalized="$(printf '%s' "$activation_flag" | tr '[:upper:]' '[:lower:]')"
if [[ "$activation_normalized" =~ ^(yes|true|1)$ ]]; then
  [[ "$turnstile_key" =~ ^[A-Za-z0-9_-]{10,128}$ ]] || fail "native registration is ON without a valid Turnstile site key"
  pass "native registration activation has an explicit flag and valid public site key"
else
  pass "native registration remains safely disabled; Safari fallback will ship"
fi

remote_push_normalized="$(printf '%s' "$remote_push_flag" | tr '[:upper:]' '[:lower:]')"
debug_remote_push_normalized="$(printf '%s' "$debug_remote_push_flag" | tr '[:upper:]' '[:lower:]')"
shop_built_in_normalized="$(printf '%s' "$shop_built_in_flag" | tr '[:upper:]' '[:lower:]')"
shop_pilot_normalized="$(printf '%s' "$shop_pilot_flag" | tr '[:upper:]' '[:lower:]')"
debug_shop_built_in_normalized="$(printf '%s' "$debug_shop_built_in_flag" | tr '[:upper:]' '[:lower:]')"
debug_shop_pilot_normalized="$(printf '%s' "$debug_shop_pilot_flag" | tr '[:upper:]' '[:lower:]')"
[[ ! "$debug_remote_push_normalized" =~ ^(yes|true|1)$ ]] || fail "Debug push cannot use the production Firebase app"
[[ "$shop_built_in_normalized" =~ ^(yes|true|1)$ ]] || fail "Release candidate must compile the native Shop surface"
[[ "$shop_pilot_normalized" =~ ^(yes|true|1)$ ]] || fail "Release candidate must enable the controlled Shop pilot"
[[ "$debug_shop_built_in_normalized" =~ ^(yes|true|1)$ ]] || fail "Debug must compile the native Shop surface for QA parity"
[[ ! "$debug_shop_pilot_normalized" =~ ^(yes|true|1)$ ]] || fail "Debug Shop pilot must fail closed by default"
version_at_least "$marketing_version" "2.1.0" || fail "Shop MVP requires marketing version 2.1.0 or later"
[[ "$build_number" -ge 9 ]] || fail "Shop MVP requires build number 9 or later"
pass "Shop MVP is built in, Release pilot is enabled and Debug remains fail closed"

firebase_config_is_valid() {
  [[ "$firebase_google_app_id" =~ ^1:[0-9]{6,}:ios:[A-Fa-f0-9]{8,}$ ]] &&
    [[ "$firebase_sender_id" =~ ^[0-9]{6,}$ ]] &&
    [[ "$firebase_api_key" =~ ^AIza[A-Za-z0-9_-]{20,}$ ]] &&
    [[ "$firebase_project_id" =~ ^[a-z][a-z0-9-]{4,62}$ ]]
}

if [[ "$remote_push_normalized" =~ ^(yes|true|1)$ ]]; then
  firebase_config_is_valid || fail "remote push is ON without valid Firebase client identifiers"
  pass "remote push activation has valid production Firebase client identifiers"
else
  pass "remote push remains safely disabled pending device smoke"
fi

auth_reset_normalized="$(printf '%s' "$auth_reset_approval" | tr '[:upper:]' '[:lower:]')"
if [[ "$auth_reset_normalized" =~ ^(yes|true|1)$ ]]; then
  pass "Capacitor-to-native sign-in reset has explicit release approval"
else
  pass "Capacitor-to-native sign-in reset is still awaiting release approval"
fi

if [[ "$shipping" == true ]]; then
  [[ "$supabase_ref" == "ajvlcamxemgbxduhiqrl" ]] || fail "shipping build does not target the production Supabase project"
  [[ -n "$supabase_anon_key" && "$supabase_anon_key" != *"placeholder"* && "$supabase_anon_key" != *"your_"* ]] || fail "shipping build has no real publishable Supabase key"
  [[ "$remote_push_normalized" =~ ^(yes|true|1)$ ]] || fail "shipping build would regress production FCM push"
  firebase_config_is_valid || fail "shipping build has no valid production Firebase client configuration"
  [[ "$auth_reset_normalized" =~ ^(yes|true|1)$ ]] || fail "existing-user sign-in reset has not been explicitly approved"
  [[ -n "$archive_path" || -n "$ipa_path" ]] || fail "--shipping requires --archive <path> or --ipa <path>"
  if [[ -z "$ipa_path" ]]; then
    security find-identity -v -p codesigning 2>/dev/null | rg 'Apple Distribution|iOS Distribution' >/dev/null || fail "no local Apple Distribution identity; validate the cloud-signed export with --ipa"
  fi
  pass "shipping credentials and production backend configuration are present"
fi

if [[ -n "$archive_path" ]]; then
  app_path="$archive_path/Products/Applications/ThePickleHub.app"
  [[ -d "$app_path" ]] || fail "archive does not contain ThePickleHub.app"
  embedded_info="$app_path/Info.plist"
  embedded_privacy="$app_path/PrivacyInfo.xcprivacy"
  [[ "$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$embedded_info")" == "$bundle_id" ]] || fail "archive bundle ID differs from Release settings"
  [[ "$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$embedded_info")" == "$marketing_version" ]] || fail "archive marketing version differs from Release settings"
  [[ "$(/usr/libexec/PlistBuddy -c 'Print :CFBundleVersion' "$embedded_info")" == "$build_number" ]] || fail "archive build number differs from Release settings"
  [[ "$(/usr/libexec/PlistBuddy -c 'Print :BuildEnvironment' "$embedded_info")" == "production" ]] || fail "archive environment is not production"
  plutil -extract UIDeviceFamily json -o - "$embedded_info" | jq -e 'index(1) != null and index(2) != null' >/dev/null || fail "archive does not support both iPhone and iPad"
  plutil -extract 'UISupportedInterfaceOrientations~ipad' json -o - "$embedded_info" | jq -e 'length == 4' >/dev/null || fail "archive lacks complete iPad orientation support"
  embedded_activation="$(/usr/libexec/PlistBuddy -c 'Print :NativeEventRegistrationEnabled' "$embedded_info")"
  [[ "$(printf '%s' "$embedded_activation" | tr '[:upper:]' '[:lower:]')" == "$(printf '%s' "$activation_flag" | tr '[:upper:]' '[:lower:]')" ]] || fail "archive activation flag differs from Release settings"
  embedded_remote_push="$(/usr/libexec/PlistBuddy -c 'Print :RemotePushEnabled' "$embedded_info")"
  [[ "$(printf '%s' "$embedded_remote_push" | tr '[:upper:]' '[:lower:]')" == "$remote_push_normalized" ]] || fail "archive remote-push flag differs from Release settings"
  embedded_shop_built_in="$(/usr/libexec/PlistBuddy -c 'Print :ShopNativeBuiltIn' "$embedded_info")"
  embedded_shop_pilot="$(/usr/libexec/PlistBuddy -c 'Print :ShopNativePilotEnabled' "$embedded_info")"
  [[ "$(printf '%s' "$embedded_shop_built_in" | tr '[:upper:]' '[:lower:]')" == "$shop_built_in_normalized" ]] || fail "archive Shop built-in flag differs from Release settings"
  [[ "$(printf '%s' "$embedded_shop_pilot" | tr '[:upper:]' '[:lower:]')" == "$shop_pilot_normalized" ]] || fail "archive Shop pilot flag differs from Release settings"
  embedded_auth_reset="$(/usr/libexec/PlistBuddy -c 'Print :CapacitorAuthResetApproved' "$embedded_info")"
  [[ "$(printf '%s' "$embedded_auth_reset" | tr '[:upper:]' '[:lower:]')" == "$auth_reset_normalized" ]] || fail "archive auth-reset approval differs from Release settings"
  [[ "$(/usr/libexec/PlistBuddy -c 'Print :ITSAppUsesNonExemptEncryption' "$embedded_info")" == "false" ]] || fail "archive export-compliance flag is missing or incorrect"
  [[ -f "$embedded_privacy" ]] || fail "archive is missing PrivacyInfo.xcprivacy"
  cmp -s ThePickleHub/App/PrivacyInfo.xcprivacy "$embedded_privacy" || fail "embedded privacy manifest differs from source"
  pass "archive identity, environment and embedded privacy manifest are valid"

  if [[ "$shipping" == true && -z "$ipa_path" ]]; then
    codesign -dv --verbose=4 "$app_path" 2>&1 | rg 'Authority=(Apple Distribution|iPhone Distribution)' >/dev/null || fail "archive is not Distribution-signed"
    signed_entitlements="$(codesign -d --entitlements :- "$app_path" 2>/dev/null || true)"
    embedded_aps_environment="$(printf '%s' "$signed_entitlements" | plutil -extract aps-environment raw -o - - 2>/dev/null || true)"
    [[ "$embedded_aps_environment" == "production" ]] || fail "signed archive lacks production APNs entitlement"
    printf '%s' "$signed_entitlements" \
      | plutil -extract 'com.apple.developer.applesignin' json -o - - 2>/dev/null \
      | jq -e 'index("Default") != null' >/dev/null \
      || fail "signed archive lacks Sign in with Apple entitlement"
    pass "archive is Distribution-signed with production APNs and Apple sign-in entitlements"
  fi
fi

if [[ -n "$ipa_path" ]]; then
  [[ -f "$ipa_path" ]] || fail "IPA does not exist: $ipa_path"
  ipa_extract_dir="$(mktemp -d /tmp/picklehub-ipa-preflight.XXXXXX)"
  unzip -q "$ipa_path" -d "$ipa_extract_dir"
  ipa_app_path="$(find "$ipa_extract_dir/Payload" -maxdepth 1 -type d -name 'ThePickleHub.app' -print -quit)"
  [[ -d "$ipa_app_path" ]] || fail "IPA does not contain Payload/ThePickleHub.app"

  ipa_info="$ipa_app_path/Info.plist"
  ipa_privacy="$ipa_app_path/PrivacyInfo.xcprivacy"
  [[ "$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$ipa_info")" == "$bundle_id" ]] || fail "IPA bundle ID differs from Release settings"
  [[ "$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$ipa_info")" == "$marketing_version" ]] || fail "IPA marketing version differs from Release settings"
  [[ "$(/usr/libexec/PlistBuddy -c 'Print :CFBundleVersion' "$ipa_info")" == "$build_number" ]] || fail "IPA build number differs from Release settings"
  [[ "$(/usr/libexec/PlistBuddy -c 'Print :BuildEnvironment' "$ipa_info")" == "production" ]] || fail "IPA environment is not production"
  plutil -extract UIDeviceFamily json -o - "$ipa_info" | jq -e 'index(1) != null and index(2) != null' >/dev/null || fail "IPA does not support both iPhone and iPad"
  plutil -extract 'UISupportedInterfaceOrientations~ipad' json -o - "$ipa_info" | jq -e 'length == 4' >/dev/null || fail "IPA lacks complete iPad orientation support"
  [[ "$(printf '%s' "$(/usr/libexec/PlistBuddy -c 'Print :NativeEventRegistrationEnabled' "$ipa_info")" | tr '[:upper:]' '[:lower:]')" == "$activation_normalized" ]] || fail "IPA activation flag differs from Release settings"
  [[ "$(printf '%s' "$(/usr/libexec/PlistBuddy -c 'Print :RemotePushEnabled' "$ipa_info")" | tr '[:upper:]' '[:lower:]')" == "$remote_push_normalized" ]] || fail "IPA remote-push flag differs from Release settings"
  [[ "$(printf '%s' "$(/usr/libexec/PlistBuddy -c 'Print :ShopNativeBuiltIn' "$ipa_info")" | tr '[:upper:]' '[:lower:]')" == "$shop_built_in_normalized" ]] || fail "IPA Shop built-in flag differs from Release settings"
  [[ "$(printf '%s' "$(/usr/libexec/PlistBuddy -c 'Print :ShopNativePilotEnabled' "$ipa_info")" | tr '[:upper:]' '[:lower:]')" == "$shop_pilot_normalized" ]] || fail "IPA Shop pilot flag differs from Release settings"
  [[ "$(printf '%s' "$(/usr/libexec/PlistBuddy -c 'Print :CapacitorAuthResetApproved' "$ipa_info")" | tr '[:upper:]' '[:lower:]')" == "$auth_reset_normalized" ]] || fail "IPA auth-reset approval differs from Release settings"
  [[ "$(/usr/libexec/PlistBuddy -c 'Print :FirebaseGoogleAppID' "$ipa_info")" == "$firebase_google_app_id" ]] || fail "IPA Firebase Google app ID differs from Release settings"
  [[ "$(/usr/libexec/PlistBuddy -c 'Print :FirebaseGCMSenderID' "$ipa_info")" == "$firebase_sender_id" ]] || fail "IPA Firebase sender ID differs from Release settings"
  [[ "$(/usr/libexec/PlistBuddy -c 'Print :FirebaseAPIKey' "$ipa_info")" == "$firebase_api_key" ]] || fail "IPA Firebase API key differs from Release settings"
  [[ "$(/usr/libexec/PlistBuddy -c 'Print :FirebaseProjectID' "$ipa_info")" == "$firebase_project_id" ]] || fail "IPA Firebase project ID differs from Release settings"
  [[ "$(/usr/libexec/PlistBuddy -c 'Print :ITSAppUsesNonExemptEncryption' "$ipa_info")" == "false" ]] || fail "IPA export-compliance flag is missing or incorrect"
  [[ -f "$ipa_privacy" ]] || fail "IPA is missing PrivacyInfo.xcprivacy"
  cmp -s ThePickleHub/App/PrivacyInfo.xcprivacy "$ipa_privacy" || fail "IPA privacy manifest differs from source"

  codesign -dv --verbose=4 "$ipa_app_path" 2>&1 | rg 'Authority=(Apple Distribution|iPhone Distribution)' >/dev/null || fail "IPA is not Apple Distribution-signed"
  ipa_entitlements="$(codesign -d --entitlements :- "$ipa_app_path" 2>/dev/null || true)"
  ipa_aps_environment="$(printf '%s' "$ipa_entitlements" | plutil -extract aps-environment raw -o - - 2>/dev/null || true)"
  [[ "$ipa_aps_environment" == "production" ]] || fail "IPA lacks production APNs entitlement"
  printf '%s' "$ipa_entitlements" \
    | plutil -extract 'com.apple.developer.applesignin' json -o - - 2>/dev/null \
    | jq -e 'index("Default") != null' >/dev/null \
    || fail "IPA lacks Sign in with Apple entitlement"

  ipa_profile="$ipa_extract_dir/embedded-profile.plist"
  security cms -D -i "$ipa_app_path/embedded.mobileprovision" > "$ipa_profile"
  [[ "$(/usr/libexec/PlistBuddy -c 'Print :Entitlements:get-task-allow' "$ipa_profile")" == "false" ]] || fail "IPA uses a development provisioning profile"
  pass "IPA is App Store-signed with Apple sign-in, production APNs, Firebase config and privacy manifest"
fi

pass "release preflight complete"
