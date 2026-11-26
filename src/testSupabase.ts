
import { supabase } from "./lib/supabase";

export async function testSupabase() {
  console.log("BẮT ĐẦU KIỂM TRA SUPABASE");

  try {
    const { data, error } = await supabase
      .from("properties")
      .select("id, title, price, area");

    if (error) {
        console.error("SUPABASE ERROR MESSAGE:", error.message);
        console.error("SUPABASE ERROR CODE:", error.code);
        console.error("SUPABASE ERROR DETAILS:", error.details);
        console.error("SUPABASE ERROR HINT:", error.hint);
  return;
}

    console.log("KẾT NỐI SUPABASE THÀNH CÔNG:", data);
  } catch (error) {
    console.error("LỖI KẾT NỐI:", error);
  }
}
