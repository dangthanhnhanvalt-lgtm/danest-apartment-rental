
/**
 * Tạm thời tắt kết nối Backend Paletto.
 * Website DaNest sử dụng mock data
 * trong quá trình chuyển sang Supabase.
 */

export async function isBackendAvailable(): Promise<boolean> {
  console.log("DaNest: Paletto Backend đã tắt");
  return false;
}

