// filepath: [usdaApi.ts](http://_vscodecontentref_/1)
export const fetchFoodsFromUSDA = async (query: string) => {
  const apiKey = "oA08OBRVJzJbtZwX0qd11Okq7E5INawkhveWnPUl";
  const url = "https://api.nal.usda.gov/fdc/v1/foods/search";

  try {
    const response = await fetch(`${url}?api_key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, pageSize: 10 }),
    });
    if (!response.ok) {
      throw new Error("Failed to fetch data from USDA API");
    }
    const data = await response.json();
    return data.foods || [];
  } catch (error) {
    console.error("Error fetching USDA data:", error);
    return [];
  }
};