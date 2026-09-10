export interface LightboxShot {
  alt: string;
  caption?: string;
  path?: string;
  src: string;
}

let current = $state<LightboxShot | null>(null);

export const lightbox = {
  get current() {
    return current;
  },
  open(shot: LightboxShot) {
    current = shot;
  },
  close() {
    current = null;
  },
};
