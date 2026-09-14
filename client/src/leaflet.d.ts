declare module "leaflet" {
  export type Map = any;
  export type Marker = any;
  export type LeafletMouseEvent = { latlng: { lat: number; lng: number } };
  const Leaflet: any;
  export default Leaflet;
}
declare module "leaflet/dist/images/*.png" { const source: string; export default source; }
