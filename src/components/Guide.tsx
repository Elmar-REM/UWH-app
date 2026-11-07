export function Guide() {
  return (
    <div className="guide">
      <h3>The game in one minute</h3>
      <p>
        Underwater hockey is played on the bottom of a swimming pool. Two teams of six push a heavy puck along the floor
        with short sticks and try to put it into the other team's goal, a 3 metre metal tray against the end wall.
        Players wear a mask, snorkel, fins, a protective glove on the stick hand and a water polo cap. Everyone holds
        their breath, so players are constantly going up for air and diving back down. Good teams plan who is up and who is
        down so there is always cover on the bottom.
      </p>

      <h3>Pool and field</h3>
      <ul>
        <li>Playing area: 21 to 25 m long and 12 to 15 m wide. 25 m by 12 to 15 m is the common size.</li>
        <li>Depth: roughly 2 to 3.65 m. Deeper water means longer trips to the surface.</li>
        <li>Goals: a 3 m wide tray on the bottom, centred against each end wall.</li>
        <li>Substitution area: on one side of the pool next to each team's own half. Use the Sub box setting to put it on the left or right.</li>
      </ul>

      <h3>Teams</h3>
      <ul>
        <li>Up to 10 players in a squad, 6 in the water at once, 4 on the bench.</li>
        <li>Rolling substitutions: players swap in and out through the sub area at any time during play.</li>
        <li>Teams play in White and Black (sometimes dark blue). Sticks must match the team colour.</li>
        <li>Each player holds the stick in one hand only. Left and right handers matter a lot for positioning, which is why the glove (stick hand) is highlighted in orange on the board.</li>
      </ul>

      <h3>Equipment</h3>
      <ul>
        <li>Stick: up to 35 cm long.</li>
        <li>Puck: lead or similar, about 1.3 to 1.5 kg, around 8 cm across.</li>
      </ul>

      <h3>Match flow</h3>
      <ul>
        <li>Two halves of around 10 to 15 minutes depending on the competition, with a short half time and a change of ends.</li>
        <li>Start of play: both teams wait touching their end wall, the puck sits in the centre, and everyone sprints on the signal. Use Automations, Start of play.</li>
        <li>Referees in the water and on deck stop play for fouls such as obstruction, holding the puck against the body or using the free hand. Results range from an advantage puck to a penalty shot or penalty goal.</li>
      </ul>

      <h3>Common shapes</h3>
      <ul>
        <li>3 forwards, 3 backs: the classic. Forwards attack in a line, backs protect the goal.</li>
        <li>3 forwards, 1 half, 2 backs: a centre half links play and cleans up loose pucks.</li>
        <li>2, 2, 2: balanced pairs that suit breathing in pairs.</li>
      </ul>

      <h3>How to use the board</h3>
      <ul>
        <li>Drag players and the puck. Drag the yellow handle in front of a selected player to turn them.</li>
        <li>Double click a player, or press U, to send them up for air or back down.</li>
        <li>Press Q or E to turn the selected player, L or R to set their stick hand.</li>
        <li>Add a frame for each step of the move. Press Play to animate between frames.</li>
        <li>Red rings warn that a move is faster than that player can swim, or that they have been down longer than their breath hold.</li>
        <li>Drag players in or out of the sub box to make substitutions.</li>
      </ul>
      <p className="muted">
        Rules summary based on the CMAS International Rules for Underwater Hockey. Exact numbers vary by competition, so all pool sizes in the app can be changed.
      </p>
    </div>
  )
}
