#!/bin/bash
for APP in pos admin-portal; do
  if [ "$APP" = "admin-portal" ]; then
    DIR="apps/$APP/client/src/components/admin/reports"
  else
    DIR="apps/$APP/client/src/components/manager/reports"
  fi
  for file in $DIR/*.jsx; do
    if grep -q "const { data = \[\], isPending } = useQuery" "$file"; then
      echo "Fixing $file"
      sed -i 's/const { data = \[\], isPending } = useQuery/const { data: rawData, isPending } = useQuery/g' "$file"
      awk '/enabled: Boolean/ { print; getline; print; print "  const data = Array.isArray(rawData) ? rawData : [];"; next }1' "$file" > tmp && mv tmp "$file"
    fi
  done
done
