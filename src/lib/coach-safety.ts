const crisisPatterns = [
  /öngyilkos/i,
  /öngyilkosság/i,
  /megölöm magam/i,
  /meg(?: akarom)? ölni magam/i,
  /kárt teszek magamban/i,
  /kárt akarok tenni magamban/i,
  /nem akarok élni/i,
  /bántani akarom magam/i,
  /véget akarok vetni az életemnek/i,
  /self[\s-]?harm/i,
  /suicid(?:e|al)/i,
  /kill myself/i,
  /hurt myself/i,
];

export function isCrisisMessage(message: string): boolean {
  return crisisPatterns.some((pattern) => pattern.test(message));
}
