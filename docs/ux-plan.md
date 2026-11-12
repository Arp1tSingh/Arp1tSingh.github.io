# The UX pass

The five-phase plan that followed the ride's first visual review. The order is
deliberate: the dead end at the end of the line came first, because everything
else is judged from a ride that can actually be finished.

## Phase 1 - The terminus and the wallet

- The journey track now carries one extra viewport of runway. The last dwell
  used to sit exactly at the end of the scrollable page and could never be
  reached; it is reachable now.
- The terminus hands over to the wallet instead of printing another ticket.
  The wallet is the closing screen: kept tickets, an email action, the résumé,
  direct contact details, "Ride again" and "Browse the map".
- An empty wallet is no longer a dead end. It explains the state and offers the
  two ways to continue.
- The station card counts kept tickets while riding, so the wallet's contents
  are visible before the terminus.

## Phase 2 - Coming back from another view

- The map and the text view are real surfaces with a "Back to the line" bar;
  the header stays above both.
- Opening a view closes the ticket. A ticket belongs to the line and used to
  float over half the map.
- Leaving the map does not touch the line's scroll position. A "Ride here"
  jump survives the return. Only the text view, a separate document, saves and
  restores the ride's scroll.
- Lazy chunks have a visible loading state instead of an empty overlay, and
  focus moves to the new view's heading and back to the control that opened it.

## Phase 3 - The phone

- The desktop navigation is a "Views" menu below 720px, with every view plus
  the résumé and "Pause motion". The map and text view used to be unreachable
  after boarding on a phone.
- The résumé is in the header, the menu and the gate.

## Phase 4 - Browsing the map

- Station selection is local to the map. The train's position and the selected
  station are different marks: red is where the ride is, board yellow is the
  card that is open.
- A station click opens its card. "Ride here" is the one action that moves the
  train.
- On a phone the skill filter sits above the plot and scrolls as one strip;
  the station card is a bottom sheet that is absent until a station is picked.
- On a wide screen the card sticks under the view bar while the line scrolls.
- Stations remain keyboard reachable, and the text fallback uses the same
  selection model.

## Phase 5 - The ticket and the first screen

- The ticket is a dialog, not a modal one: the header stays usable, Escape
  closes it, a click outside closes it, and focus is handed in and back out.
  No Tab trap.
- The serial and Close sit in a sticky top bar. Keep ticket lives in the
  Actions row and confirms in place ("Saved for the terminus.").
- Progress dots have 24x24px hit areas while the mark stays 7px.
- The gate puts the route choices before the location and contact facts, and
  offers the résumé.
- "Classic" is now "Text view" and "Pause" is "Pause motion" everywhere a
  visitor reads them.
- Journey shortcuts are ignored inside the ticket, the map, the text view and
  the wallet. `T` (or `C`) opens the text view, `M` the map, `E` Express.

## Not changed

- The ticket QR was retired before this pass and stays retired; the wallet is
  still browser-local and sends nothing unless the visitor uses the mailto.
- The concept palette, flat surfaces, hairlines and the third-rail scene are
  untouched.
