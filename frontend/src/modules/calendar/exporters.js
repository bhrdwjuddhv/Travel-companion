import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { createEvents } from 'ics';
import { EXPORT } from '../../constants';

export const slugify = (s) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'trip';

const download = (href, filename) => {
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  link.click();
};

/**
 * One page per day, each page sized to its own card — a packed day gets a
 * taller page rather than being crushed onto A4.
 */
export async function exportPdf(dayNodes, tripName) {
  if (!dayNodes.length) throw new Error('Nothing to export yet.');
  // Webfonts that haven't loaded render as blank boxes in the capture.
  await document.fonts?.ready;

  let pdf = null;
  for (const node of dayNodes) {
    const dataUrl = await toPng(node, {
      pixelRatio: EXPORT.pixelRatio,
      backgroundColor: EXPORT.backgroundColor,
      cacheBust: true,
    });
    const { width, height } = await imageSize(dataUrl);

    if (!pdf) {
      pdf = new jsPDF({ unit: EXPORT.pdfPageUnit, format: [width, height], orientation: width > height ? 'l' : 'p' });
    } else {
      pdf.addPage([width, height], width > height ? 'l' : 'p');
    }
    pdf.addImage(dataUrl, 'PNG', 0, 0, width, height);
  }

  pdf.save(EXPORT.pdfFilename.replace('{trip}', slugify(tripName)));
}

const imageSize = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error('Could not measure the rendered day'));
    img.src = src;
  });

// ics wants [year, month, day, hour, minute] with a 1-based month.
const toParts = (iso, time = '09:00') => {
  const [y, m, d] = iso.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  return [y, m, d, hh || 9, mm || 0];
};

const money = (n) => `INR ${Number(n).toLocaleString('en-IN')}`;

/**
 * VEVENTs for the legs, the stays and every activity, so the trip drops
 * straight into Google or Apple Calendar.
 */
export async function exportIcs(trip, tripName) {
  const { plan } = trip;
  const events = [];

  for (const seg of plan.segments) {
    if (!seg.date) continue;
    events.push({
      title: `${seg.fromPlace} → ${seg.toPlace} (${seg.mode})`,
      description: [seg.service, `${money(seg.fare)}${seg.fareType === 'estimate' ? ' est' : ''}`, `${seg.distanceKm} km`]
        .filter(Boolean)
        .join(' · '),
      start: toParts(seg.date, '08:00'),
      duration: { minutes: Math.max(seg.durationMinutes || 60, 15) },
    });
  }

  for (const stay of plan.stays) {
    const firstDay = plan.days.find((d) => d.destination === stay.destination && d.date);
    if (!firstDay) continue;
    events.push({
      title: `Stay: ${stay.name}`,
      description: `${money(stay.pricePerNight)}/night${stay.priceType === 'estimate' ? ' est' : ''} · ${stay.nights} night(s)`,
      start: toParts(firstDay.date, '15:00'),
      duration: { hours: 1 },
    });
  }

  for (const day of plan.days) {
    if (!day.date) continue;
    day.activities.forEach((a, i) => {
      events.push({
        title: a.name,
        location: `${a.name}, ${day.destination}`,
        description: [
          a.ticketCost ? money(a.ticketCost) : 'free',
          a.isHiddenGem ? 'hidden gem' : null,
          a.notes,
        ]
          .filter(Boolean)
          .join(' · '),
        // No planned time? Space them out through the day rather than stacking.
        start: toParts(day.date, a.plannedStart ?? `${String(10 + i * 2).padStart(2, '0')}:00`),
        duration: { minutes: a.durationMinutes ?? 90 },
      });
    });
  }

  if (!events.length) throw new Error('This plan has no dated items to export.');

  const { error, value } = createEvents(events);
  if (error) throw error;

  download(`data:text/calendar;charset=utf-8,${encodeURIComponent(value)}`, EXPORT.icsFilename.replace('{trip}', slugify(tripName)));
  return events.length;
}
