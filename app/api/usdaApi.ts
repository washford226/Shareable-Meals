export const fetchFoodsFromUSDA = async () => {
    const apiKey = "EdQwpayT3bDWT9ITiDKwlIswWeJ7jdZgUCGRyQo7";
    const url = "https://api.nal.usda.gov/fdc/v1/foods";
  
    try {
      const response = await fetch(`${url}?api_key=${apiKey}`);
      if (!response.ok) {
        throw new Error("Failed to fetch data from USDA API");
      }
      const data = await response.json();
      return data; // Assuming the API returns an array of food items
    } catch (error) {
      console.error("Error fetching USDA data:", error);
      return [];
    }
  };