import SwiftUI
import UIKit

/// Loads item photos through the authenticated API session and caches them in memory.
actor ImageCache {
    static let shared = ImageCache()

    private let cache = NSCache<NSURL, UIImage>()
    private var inFlight: [URL: Task<UIImage?, Never>] = [:]
    /// itemId -> primary image id (nil = item has no photos). Avoids re-listing on every row.
    private var primaryIds: [String: String?] = [:]

    init() {
        cache.countLimit = 300
    }

    func image(for url: URL, session: URLSession) async -> UIImage? {
        if let cached = cache.object(forKey: url as NSURL) { return cached }
        if let task = inFlight[url] { return await task.value }
        let task = Task<UIImage?, Never> {
            guard let (data, response) = try? await session.data(from: url),
                  (response as? HTTPURLResponse)?.statusCode == 200,
                  let image = UIImage(data: data) else { return nil }
            return await image.byPreparingForDisplay() ?? image
        }
        inFlight[url] = task
        let image = await task.value
        inFlight[url] = nil
        if let image { cache.setObject(image, forKey: url as NSURL) }
        return image
    }

    func primaryImageId(itemId: String, api: APIClient) async -> String? {
        if let known = primaryIds[itemId] { return known }
        guard let images = try? await api.images(itemId: itemId) else { return nil }
        let id = (images.first { $0.isPrimary } ?? images.first)?.id
        primaryIds[itemId] = .some(id)
        return id
    }

    func invalidate(itemId: String) {
        primaryIds[itemId] = nil
    }
}

/// A square item thumbnail: the primary photo when there is one, else a tinted monogram.
struct ItemThumbnail: View {
    @Environment(AppModel.self) private var model
    let itemId: String
    let name: String
    var size: CGFloat = 44
    var reloadToken: Int = 0

    @State private var image: UIImage?

    var body: some View {
        ZStack {
            if let image {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFill()
                    .transition(.opacity)
            } else {
                Monogram(name: name, size: size)
            }
        }
        .frame(width: size, height: size)
        .clipShape(.rect(cornerRadius: size * 0.26, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: size * 0.26, style: .continuous)
                .strokeBorder(Color.primary.opacity(0.06))
        }
        .task(id: "\(itemId)-\(reloadToken)") {
            let api = model.api
            guard let imageId = await ImageCache.shared.primaryImageId(itemId: itemId, api: api) else {
                image = nil
                return
            }
            let loaded = await ImageCache.shared.image(for: api.imageURL(id: imageId), session: api.session)
            withAnimation(.easeOut(duration: 0.2)) { image = loaded }
        }
    }
}

struct Monogram: View {
    let name: String
    var size: CGFloat = 44

    private var letters: String {
        let words = name.split(whereSeparator: { $0 == " " || $0 == "-" }).prefix(2)
        let result = words.compactMap { $0.first.map(String.init) }.joined().uppercased()
        return result.isEmpty ? "#" : result
    }

    private var tint: Color {
        let palette: [Color] = [.blue, .indigo, .purple, .pink, .orange, .teal, .green, .cyan, .mint, .brown]
        let hash = name.unicodeScalars.reduce(0) { ($0 &* 31 &+ Int($1.value)) & 0x7fffffff }
        return palette[hash % palette.count]
    }

    var body: some View {
        ZStack {
            tint.opacity(0.16)
            Text(letters)
                .font(.system(size: size * 0.36, weight: .bold, design: .rounded))
                .foregroundStyle(tint)
        }
        .frame(width: size, height: size)
    }
}

/// Full-size photo loaded through the API session.
struct RemoteImage: View {
    @Environment(AppModel.self) private var model
    let imageId: String
    var contentMode: ContentMode = .fill

    @State private var image: UIImage?
    @State private var failed = false

    var body: some View {
        ZStack {
            if let image {
                Image(uiImage: image)
                    .resizable()
                    .aspectRatio(contentMode: contentMode)
            } else if failed {
                Image(systemName: "photo")
                    .font(.largeTitle)
                    .foregroundStyle(.tertiary)
            } else {
                ProgressView()
            }
        }
        .task(id: imageId) {
            let api = model.api
            image = await ImageCache.shared.image(for: api.imageURL(id: imageId), session: api.session)
            failed = image == nil
        }
    }
}
