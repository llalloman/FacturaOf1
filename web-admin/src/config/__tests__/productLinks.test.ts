import { describe, expect, it } from 'vitest';
import { productLinksForUser } from '../productLinks';

describe('product links', () => {
  it('does not expose admin without capability', () => {
    const links = productLinksForUser('facturaof1', false);
    expect(links.map((link) => link.label)).toEqual(['Firmador']);
  });

  it('keeps each product link independent from the current route', () => {
    const links = productLinksForUser('of1-admin', true);
    expect(links.map((link) => link.label)).toEqual(['FacturaOF1', 'Firmador']);
  });
});
