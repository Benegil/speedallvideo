/* SpeedAllVideo — signal sonore partagé (pages vidéo, popup, options).
   Un « blip » façon jeu vidéo qui GLISSE de l'ancienne vitesse vers la
   nouvelle : la hauteur suit la vitesse (1x = la 440 Hz, 2x = octave au-
   dessus, 0.5x = en dessous). Volume discret. Le navigateur n'autorise l'audio
   qu'après un geste de l'utilisateur : n'appeler que depuis un clic/une touche.
   var / function : redéclarables si le script est injecté deux fois. */
var savActx = null;
var savLastBlip = 0;
function blip(to, from) {
    const now = Date.now();
    if (now - savLastBlip < 60) return; // curseur : pas de mitraillage
    savLastBlip = now;
    try {
        savActx = savActx || new (window.AudioContext || window.webkitAudioContext)();
        if (savActx.state === 'suspended') savActx.resume();
        const t = savActx.currentTime;
        const o = savActx.createOscillator(), g = savActx.createGain();
        o.type = 'square';
        o.frequency.setValueAtTime(440 * (from || to), t);
        o.frequency.exponentialRampToValueAtTime(440 * to, t + 0.09);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.05, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
        o.connect(g); g.connect(savActx.destination);
        o.start(t); o.stop(t + 0.2);
    } catch (e) { /* pas d'audio : silencieux */ }
}
