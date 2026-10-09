# Acornaut iOS AdMob setup

The iOS app and its Rewarded and Interstitial units are configured in
`app.config.json`: the real AdMob app id and the two unit ids are in, and
`admob.testing` stays **true** on main. Flip it to `false` in the commit
that cuts the archive for App Store review, and nowhere earlier: with it
false, a TestFlight build requests live ads against an AdMob app that is
not yet linked to a store listing. Android ids remain Google's demo ids
because Android setup is deferred.

## Safe development and TestFlight checks

With `admob.testing: true` the adapter passes `initializeForTesting` and
`isTesting`, which selects Google's demo units, so no real unit serves. A
running bundle keeps the previous flag until rebuilt. Never edit the
generated `adapter/config.json`; the web build writes it. Google also
supports registered test devices with real units; verify test mode before
interacting with an ad. An unpublished AdMob app can receive limited live ads.

`npm run test:config` exercises the actual web builder with tiny temporary
fixtures and a mocked bundler. It verifies all AdMob ids reach the adapter
with both the release and the test flag, without installing packages,
initialising an SDK or loading any ads.

`npm run test:adapter` runs the actual native adapter module in a Node VM
with mocked plugins: initialise-then-consent ordering, every consent and
privacy-options failure disabling ads while the game still boots, consent
generations (a stale preload can never mark an ad ready after a privacy
change), the started callbacks firing on the native Showed events, and the
reward paying only on the Rewarded event.

## Consent (UMP)

The adapter initialises the SDK first (the plugin's consent executor needs
it), then requests consent info, shows the consent form where it is
required and available, and gates every prepare and show on
`canRequestAds === true`. Any error on that path disables ads for the
session; the game boots regardless. If `privacyOptionsRequirementStatus`
is REQUIRED, the game's Profile shows a PRIVACY OPTIONS row (the bridge's
`privacyOptionsRequired` / `showPrivacyOptionsForm`); after the form the
adapter refreshes consent info, drops every loaded ad, and reloads only if
still allowed.

## Native and account prerequisites

The iOS SPM dependency list includes `CapacitorCommunityAdmob`, matching
the pinned npm plugin. On the build machine, `npx cap sync ios` must also
regenerate the ignored iOS `capacitor.config.json` with `AdMobPlugin` in
`packageClassList`. This checkout has not run dependency installation,
full native sync, Xcode compilation or device QA.

AdMob reports Requires review / Limited ad serving, and payment setup is
incomplete. Before launch: link the published App Store listing, expose the
developer website through its Marketing URL, host the account's exact
`app-ads.txt` line at that domain's root, and complete app verification
and readiness review. Payment setup, hosting and store submission are the
owner's.

**Account moved, 9 Oct 2026.** The ids above the fold now come from the
LLC's AdMob account (publisher `pub-1941049073659574`, business payments
profile): app `~8344445678`, rewarded `/2699479164`, interstitial
`/5381482821`. The earlier personal account (`pub-4551315319006015`,
individual payments profile, which Google cannot convert) is to be
cancelled by the owner once the new one is approved. The site root now
hosts the new account's `app-ads.txt` line (`docs/app-ads.txt`). The UMP
consent messages (Privacy & messaging: European regulations and US state
regulations) live per account and have to be created and published again
in the new one, or the consent sheet and Profile → Privacy Options never
appear and EEA traffic does not serve.

Sources: [Google test ads](https://developers.google.com/admob/ios/test-ads),
[app setup](https://support.google.com/admob/answer/9989980?hl=en),
[app-ads.txt](https://support.google.com/admob/answer/9363762?hl=en),
[app verification](https://support.google.com/admob/answer/14538460?hl=en),
[UMP on iOS](https://developers.google.com/admob/ios/privacy).
