# Design Exports

Figma prototype:
https://www.figma.com/proto/CKINFdLVnvPKf406ls6oDc/societyAPP

A prototype link cannot be read programmatically — Figma renders through a
canvas behind auth. Export the frames as images here instead.

## How to export

In Figma: select the frames → right panel → Export → PNG at 2x → Export.
Or select a whole page and use `Export frames` to get them all at once.

## Naming

Use `NN-screen-name.png`, numbered in flow order, in the folder for the
surface it belongs to:

    design/mobile/01-splash.png
    design/mobile/02-phone-login.png
    design/mobile/03-otp-verify.png
    design/committee/01-login.png
    design/platform/01-society-list.png

The number is the order a user moves through them; the name is what the
screen is called in the app, not what the Figma frame is called.

## What happens next

Each screen gets mapped to the API operations it needs, against
`backend/openapi.json`. That produces three lists:

- screens the backend can already serve
- screens that need endpoints which do not exist yet
- endpoints with no screen, which are either dead surface or a missing screen
