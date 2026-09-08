/** Скан ещё в работе — есть смысл опрашивать сервер. */
export function isPending(status) {
  return status === "queued" || status === "running";
}
